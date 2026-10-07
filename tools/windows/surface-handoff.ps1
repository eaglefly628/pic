$ErrorActionPreference = "Stop"

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

try {
    Step "Locating the S300 handoff bundle"
    $bundle = Get-ChildItem -LiteralPath $PSScriptRoot -Filter "photo-handoff-surface-*.zip" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1

    if (-not $bundle) {
        $roots = @("Z:\")
        $roots += Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayRoot } | ForEach-Object { $_.Root }
        foreach ($root in ($roots | Select-Object -Unique)) {
            if (-not (Test-Path -LiteralPath $root)) { continue }
            $bundle = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
                ForEach-Object {
                    Get-ChildItem -LiteralPath $_.FullName -Filter "photo-handoff-surface-*.zip" -File -ErrorAction SilentlyContinue
                } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($bundle) { break }
        }
    }
    if (-not $bundle) {
        throw "No photo handoff ZIP was found on Z: or another mapped network drive."
    }
    $sourceRoot = [System.IO.Path]::GetPathRoot($bundle.FullName)
    if (-not $sourceRoot -or -not (Test-Path -LiteralPath $sourceRoot)) {
        throw "The mapped S300 drive is unavailable."
    }
    Write-Host "S300 root: $sourceRoot"
    Write-Host "Bundle: $($bundle.FullName)"

    $python = Get-Command py -ErrorAction SilentlyContinue
    if (-not $python) { $python = Get-Command python -ErrorAction SilentlyContinue }
    if (-not $python) { throw "Python 3 was not found." }
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) { throw "Git for Windows was not found." }

    Step "Locating or preparing the PIC repository"
    $known = @(
        (Join-Path $env:USERPROFILE "pic"),
        (Join-Path $env:USERPROFILE "Documents\pic"),
        (Join-Path $env:USERPROFILE "Desktop\pic"),
        (Join-Path $env:USERPROFILE "source\repos\pic"),
        "C:\pic",
        (Join-Path $env:LOCALAPPDATA "PIC-Codex")
    )
    $repo = $known | Where-Object { Test-Path -LiteralPath (Join-Path $_ "run.py") } | Select-Object -First 1
    if (-not $repo) {
        $repo = Join-Path $env:LOCALAPPDATA "PIC-Codex"
        Write-Host "Cloning the repository to: $repo"
        & $git.Source clone --branch codex/data-continuity-latest https://github.com/eaglefly628/pic.git $repo
        if ($LASTEXITCODE -ne 0) { throw "The repository could not be downloaded." }
    }
    $repo = (Resolve-Path -LiteralPath $repo).Path
    Write-Host "Repository: $repo"

    Step "Stopping an older local server"
    $listeners = Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
        if ($process -and $process.CommandLine -match "run\.py") {
            Stop-Process -Id $listener.OwningProcess -Force
            Write-Host "Stopped the older run.py server."
        } elseif ($listener) {
            throw "Port 5180 is used by another process (PID $($listener.OwningProcess))."
        }
    }

    Step "Updating the code from GitHub"
    & $git.Source -C $repo fetch origin
    if ($LASTEXITCODE -ne 0) { throw "GitHub could not be reached." }
    & $git.Source -C $repo switch codex/data-continuity-latest
    if ($LASTEXITCODE -ne 0) { throw "The Codex branch could not be selected." }
    & $git.Source -C $repo pull --ff-only origin codex/data-continuity-latest
    if ($LASTEXITCODE -ne 0) { throw "The latest code could not be pulled." }

    Step "Importing the analyzed index and rebinding it to $sourceRoot"
    $handoffDir = Join-Path $env:LOCALAPPDATA "PIC-Handoff"
    New-Item -ItemType Directory -Path $handoffDir -Force | Out-Null
    $localBundle = Join-Path $handoffDir "photo-handoff.zip"
    Copy-Item -LiteralPath $bundle.FullName -Destination $localBundle -Force
    $handoff = Join-Path $repo "project-two\scripts\photo_handoff.py"
    $handoffLog = Join-Path $bundle.DirectoryName "surface-handoff-last.log"
    $handoffOutput = & $python.Source $handoff import --bundle $localBundle --source-root $sourceRoot --replace --keep-newer 2>&1
    $handoffExit = $LASTEXITCODE
    $handoffOutput | Out-String | Set-Content -LiteralPath $handoffLog -Encoding UTF8
    $handoffOutput | ForEach-Object { Write-Host $_ }
    if ($handoffExit -ne 0) {
        Start-Process notepad.exe -ArgumentList $handoffLog
        throw "The photo index handoff failed. The detailed log was opened in Notepad."
    }

    Step "Handoff completed; starting the app"
    Write-Host "Expected: metadata 132,213 complete; organization at least 1,336 / 104,687." -ForegroundColor Green
    Write-Host "Keep this window open while the app is running." -ForegroundColor Green
    Set-Location -LiteralPath $repo
    & $python.Source (Join-Path $repo "run.py")
    if ($LASTEXITCODE -ne 0) { throw "The app exited with code $LASTEXITCODE." }
}
catch {
    Write-Host ""
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
