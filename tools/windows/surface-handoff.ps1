$ErrorActionPreference = "Stop"

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

try {
    Step "确认 S300 和接力包"
    $sourceRoot = [System.IO.Path]::GetPathRoot($PSScriptRoot)
    if (-not $sourceRoot -or -not (Test-Path -LiteralPath $sourceRoot)) {
        throw "无法识别 S300 盘符。请从已经映射的 Z: 盘双击本文件。"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot "家庭影像库"))) {
        throw "当前盘符 $sourceRoot 下没有“家庭影像库”，可能映射了错误的共享层级。"
    }
    $bundle = Get-ChildItem -LiteralPath $PSScriptRoot -Filter "photo-handoff-surface-*.zip" -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $bundle) { throw "接力目录中没有找到照片索引 ZIP。" }
    Write-Host "已找到 S300：$sourceRoot"
    Write-Host "已找到接力包：$($bundle.Name)"

    $python = Get-Command py -ErrorAction SilentlyContinue
    if (-not $python) { $python = Get-Command python -ErrorAction SilentlyContinue }
    if (-not $python) { throw "没有找到 Python 3。" }
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) { throw "没有找到 Git for Windows。" }

    Step "查找或准备 PIC 工程"
    $known = @(
        (Join-Path $env:USERPROFILE "pic"),
        (Join-Path $env:USERPROFILE "Documents\pic"),
        (Join-Path $env:USERPROFILE "Desktop\pic"),
        (Join-Path $env:USERPROFILE "source\repos\pic"),
        (Join-Path $env:LOCALAPPDATA "PIC-Codex")
    )
    $repo = $known | Where-Object { Test-Path -LiteralPath (Join-Path $_ "run.py") } | Select-Object -First 1
    if (-not $repo) {
        $repo = Join-Path $env:LOCALAPPDATA "PIC-Codex"
        Write-Host "未找到现有工程，正在自动下载到：$repo"
        & $git.Source clone --branch codex/data-continuity-latest https://github.com/eaglefly628/pic.git $repo
        if ($LASTEXITCODE -ne 0) { throw "自动下载代码失败，请检查网络。" }
    }
    $repo = (Resolve-Path -LiteralPath $repo).Path
    Write-Host "使用工程：$repo"

    Step "停止旧版应用"
    $listeners = Get-NetTCPConnection -LocalPort 5180 -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
        if ($process -and $process.CommandLine -match "run\.py") {
            Stop-Process -Id $listener.OwningProcess -Force
            Write-Host "已停止旧服务。"
        } elseif ($listener) {
            throw "端口 5180 被其他程序占用，请先关闭 PID $($listener.OwningProcess)。"
        }
    }

    Step "自动更新 GitHub 代码"
    & $git.Source -C $repo fetch origin
    if ($LASTEXITCODE -ne 0) { throw "无法连接 GitHub 更新代码。" }
    & $git.Source -C $repo switch codex/data-continuity-latest
    if ($LASTEXITCODE -ne 0) { throw "切换开发分支失败，本地可能有未提交修改。" }
    & $git.Source -C $repo pull --ff-only origin codex/data-continuity-latest
    if ($LASTEXITCODE -ne 0) { throw "拉取最新代码失败。" }

    Step "自动导入接力数据库并绑定到 $sourceRoot"
    $handoffDir = Join-Path $env:LOCALAPPDATA "PIC-Handoff"
    New-Item -ItemType Directory -Path $handoffDir -Force | Out-Null
    $localBundle = Join-Path $handoffDir "photo-handoff.zip"
    Copy-Item -LiteralPath $bundle.FullName -Destination $localBundle -Force
    $handoff = Join-Path $repo "project-two\scripts\photo_handoff.py"
    & $python.Source $handoff import --bundle $localBundle --source-root $sourceRoot --replace --keep-newer
    if ($LASTEXITCODE -ne 0) { throw "数据库自动接力失败。" }

    Step "接力完成，正在启动应用"
    Write-Host "页面应显示：时间地点分析已完成，整理进度至少 1,336 / 104,687。" -ForegroundColor Green
    Write-Host "请保持本窗口打开。" -ForegroundColor Green
    Set-Location -LiteralPath $repo
    & $python.Source (Join-Path $repo "run.py")
    if ($LASTEXITCODE -ne 0) { throw "应用退出，代码 $LASTEXITCODE。" }
}
catch {
    Write-Host ""
    Write-Host "失败：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
