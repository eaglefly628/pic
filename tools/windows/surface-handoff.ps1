$ErrorActionPreference = "Stop"

$handoffLogDir = Join-Path $env:LOCALAPPDATA "PIC-Handoff"
New-Item -ItemType Directory -Path $handoffLogDir -Force | Out-Null
$localHandoffLog = Join-Path $handoffLogDir "surface-handoff-last.log"
$shareHandoffLog = $null
@(
    "Computer photo handoff log"
    "Started: $([DateTime]::Now.ToString('s'))"
    "Computer: $env:COMPUTERNAME"
    "User: $env:USERNAME"
) | Set-Content -LiteralPath $localHandoffLog -Encoding UTF8

function Append-Log([string]$Message) {
    $Message | Add-Content -LiteralPath $script:localHandoffLog -Encoding UTF8
}

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
    Append-Log ""
    Append-Log "==> $Message"
}

try {
    Step "Locating the S300 handoff bundle"
    $bundle = Get-ChildItem -LiteralPath $PSScriptRoot -Filter "photo-handoff-*.zip" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "photo-handoff-computer-*.zip" -or $_.Name -like "photo-handoff-surface-*.zip" } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1

    if (-not $bundle) {
        $roots = @("Z:\")
        $roots += Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayRoot } | ForEach-Object { $_.Root }
        foreach ($root in ($roots | Select-Object -Unique)) {
            if (-not (Test-Path -LiteralPath $root)) { continue }
            $bundle = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
                ForEach-Object {
                    Get-ChildItem -LiteralPath $_.FullName -Filter "photo-handoff-*.zip" -File -ErrorAction SilentlyContinue |
                        Where-Object { $_.Name -like "photo-handoff-computer-*.zip" -or $_.Name -like "photo-handoff-surface-*.zip" }
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
    $shareHandoffLog = Join-Path $bundle.DirectoryName "surface-handoff-last.log"
    Append-Log "S300 root: $sourceRoot"
    Append-Log "Bundle: $($bundle.FullName)"

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
    Append-Log "Repository: $repo"

    Step "Finding a working Python 3 interpreter"
    $pythonCandidates = @()
    foreach ($venvPython in @(
        (Join-Path $repo ".venv\Scripts\python.exe"),
        (Join-Path $repo "venv\Scripts\python.exe")
    )) {
        if (Test-Path -LiteralPath $venvPython) {
            $pythonCandidates += [PSCustomObject]@{ Path = $venvPython; Prefix = @() }
        }
    }
    foreach ($commandName in @("py", "python", "python3")) {
        $command = Get-Command $commandName -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($command) {
            $prefix = @()
            if ($commandName -eq "py") { $prefix = @("-3") }
            $pythonCandidates += [PSCustomObject]@{ Path = $command.Source; Prefix = $prefix }
        }
    }
    $commonPython = @()
    $commonPython += Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Programs\Python\Python*\python.exe") -File -ErrorAction SilentlyContinue
    $commonPython += Get-ChildItem -Path (Join-Path $env:ProgramFiles "Python*\python.exe") -File -ErrorAction SilentlyContinue
    $commonPython += Get-ChildItem -Path "C:\Python*\python.exe" -File -ErrorAction SilentlyContinue
    foreach ($pythonFile in ($commonPython | Sort-Object FullName -Descending)) {
        $pythonCandidates += [PSCustomObject]@{ Path = $pythonFile.FullName; Prefix = @() }
    }

    $pythonExe = $null
    $pythonPrefix = @()
    $pythonVersion = $null
    $pythonTestOut = Join-Path $handoffLogDir "python-test-stdout.log"
    $pythonTestErr = Join-Path $handoffLogDir "python-test-stderr.log"
    foreach ($candidate in $pythonCandidates) {
        $candidatePrefix = @($candidate.Prefix)
        Append-Log "Testing Python candidate: $($candidate.Path) $($candidatePrefix -join ' ')"
        $previousErrorPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            & $candidate.Path $candidatePrefix -c "import sys; assert sys.version_info >= (3, 9); print(sys.executable); print(sys.version.split()[0])" 1> $pythonTestOut 2> $pythonTestErr
            $pythonTestExit = $LASTEXITCODE
        }
        catch {
            $pythonTestExit = -1
            $_ | Out-String | Set-Content -LiteralPath $pythonTestErr -Encoding UTF8
        }
        finally {
            $ErrorActionPreference = $previousErrorPreference
        }
        if ($pythonTestExit -eq 0) {
            $pythonExe = $candidate.Path
            $pythonPrefix = $candidatePrefix
            $pythonVersion = (Get-Content -LiteralPath $pythonTestOut | Select-Object -Last 1)
            break
        }
        Append-Log "Rejected Python candidate with exit code $pythonTestExit"
        if (Test-Path -LiteralPath $pythonTestErr) {
            Get-Content -LiteralPath $pythonTestErr | ForEach-Object { Append-Log $_ }
        }
    }
    if (-not $pythonExe) {
        throw "No working Python 3.9+ interpreter was found. The Windows Store Python alias is not a real installation."
    }
    Write-Host "Python: $pythonExe $($pythonPrefix -join ' ') (version $pythonVersion)" -ForegroundColor Green
    Append-Log "Selected Python: $pythonExe $($pythonPrefix -join ' ')"
    Append-Log "Python version: $pythonVersion"

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
    $stdoutLog = Join-Path $handoffDir "photo-handoff-stdout.log"
    $stderrLog = Join-Path $handoffDir "photo-handoff-stderr.log"
    Append-Log "Python: $pythonExe $($pythonPrefix -join ' ')"
    Append-Log "Importer: $handoff"
    Append-Log "Local bundle: $localBundle"
    Append-Log "Source root: $sourceRoot"
    $previousErrorPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5 can turn native stderr into a terminating error
        # when ErrorActionPreference is Stop. Redirect both streams to local
        # files first so the real Python error always survives.
        $ErrorActionPreference = "Continue"
        & $pythonExe $pythonPrefix $handoff import --bundle $localBundle --source-root $sourceRoot --replace --keep-newer 1> $stdoutLog 2> $stderrLog
        $handoffExit = $LASTEXITCODE
    }
    catch {
        $handoffExit = -1
        $_ | Out-String | Set-Content -LiteralPath $stderrLog -Encoding UTF8
    }
    finally {
        $ErrorActionPreference = $previousErrorPreference
    }
    Append-Log "Exit code: $handoffExit"
    Append-Log "--- stdout ---"
    if (Test-Path -LiteralPath $stdoutLog) {
        Get-Content -LiteralPath $stdoutLog | ForEach-Object { Append-Log $_; Write-Host $_ }
    } else {
        Append-Log "(no stdout file)"
    }
    Append-Log "--- stderr ---"
    if (Test-Path -LiteralPath $stderrLog) {
        Get-Content -LiteralPath $stderrLog | ForEach-Object { Append-Log $_; Write-Host $_ -ForegroundColor Red }
    } else {
        Append-Log "(no stderr file)"
    }
    try {
        Copy-Item -LiteralPath $localHandoffLog -Destination $shareHandoffLog -Force
    } catch {
        Append-Log "Could not copy the log to S300: $($_.Exception.Message)"
    }
    if ($handoffExit -ne 0) {
        throw "The photo index handoff failed with exit code $handoffExit."
    }

    Step "Handoff completed; starting the app"
    Write-Host "Expected: metadata 132,213 complete; organization at least 1,336 / 104,687." -ForegroundColor Green
    Write-Host "Keep this window open while the app is running." -ForegroundColor Green
    Set-Location -LiteralPath $repo
    & $pythonExe $pythonPrefix (Join-Path $repo "run.py")
    if ($LASTEXITCODE -ne 0) { throw "The app exited with code $LASTEXITCODE." }
}
catch {
    Append-Log ""
    Append-Log "FAILED: $($_.Exception.Message)"
    Append-Log ($_.ScriptStackTrace | Out-String)
    if ($shareHandoffLog) {
        try {
            Copy-Item -LiteralPath $localHandoffLog -Destination $shareHandoffLog -Force
        } catch {
            Append-Log "Could not copy the final log to S300: $($_.Exception.Message)"
        }
    }
    Write-Host ""
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Detailed log: $localHandoffLog" -ForegroundColor Yellow
    Start-Process notepad.exe -ArgumentList ('"{0}"' -f $localHandoffLog)
    exit 1
}
