param(
    [Parameter(Mandatory = $true)]
    [string[]]$GradleArgs
)

$ErrorActionPreference = "Stop"

function Invoke-GradleCommand {
    param(
        [string[]]$ArgsToRun
    )

    $captured = @()
    $previousErrorActionPreference = $ErrorActionPreference
    $nativePreferenceExists = $null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
    if ($nativePreferenceExists) {
        $previousNativePreference = $PSNativeCommandUseErrorActionPreference
    }

    try {
        # Gradle writes warnings to stderr during normal execution; treat exit code as source of truth.
        $ErrorActionPreference = "SilentlyContinue"
        if ($nativePreferenceExists) {
            $PSNativeCommandUseErrorActionPreference = $false
        }

        & ".\gradlew.bat" @ArgsToRun 2>&1 | Tee-Object -Variable captured | Out-Host
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        if ($nativePreferenceExists) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
    }

    return @{
        ExitCode = $LASTEXITCODE
        Output = ($captured | Out-String)
    }
}

function Remove-DirectoryIfExists {
    param(
        [string]$Path
    )

    if (Test-Path $Path) {
        Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot

try {
    $normalizedGradleArgs = @()
    foreach ($arg in $GradleArgs) {
        if ($arg -match "\s") {
            $normalizedGradleArgs += ($arg -split "\s+" | Where-Object { $_ -and $_.Trim().Length -gt 0 })
        }
        else {
            $normalizedGradleArgs += $arg
        }
    }

    $baseArgs = @($normalizedGradleArgs + "--console=plain" + "--no-daemon")

    Write-Host "[ksp-recovery] Running Gradle: $($baseArgs -join ' ')"
    $firstRun = Invoke-GradleCommand -ArgsToRun $baseArgs
    if ($firstRun.ExitCode -eq 0) {
        exit 0
    }

    $isKspCollision =
        ($firstRun.Output -match "FileAlreadyExistsException") -and
        ($firstRun.Output -match "generated[\\/]ksp")

    if (-not $isKspCollision) {
        Write-Host "[ksp-recovery] Gradle failed for non-KSP-collision reason; no auto-recovery applied."
        exit $firstRun.ExitCode
    }

    Write-Host "[ksp-recovery] Detected KSP collision. Stopping daemons and cleaning outputs..."

    Invoke-GradleCommand -ArgsToRun @("--stop") | Out-Null

    $javaProcesses = Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -eq "java.exe" -and
            ($_.CommandLine -match "org\\.jetbrains\\.kotlin\\.daemon|GradleDaemon")
        }

    foreach ($process in $javaProcesses) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Remove-DirectoryIfExists -Path ".\\app\\build\\generated\\ksp"
    Remove-DirectoryIfExists -Path ".\\app\\build\\kspCaches"
    Remove-DirectoryIfExists -Path ".\\app\\build\\tmp\\kotlin-classes"

    $cleanRun = Invoke-GradleCommand -ArgsToRun @(":app:clean", "--console=plain", "--no-daemon")
    if ($cleanRun.ExitCode -ne 0) {
        Write-Host "[ksp-recovery] Clean failed (likely due transient file locks); continuing with retry."
    }

    Write-Host "[ksp-recovery] Retrying Gradle command..."
    $retryRun = Invoke-GradleCommand -ArgsToRun $baseArgs
    exit $retryRun.ExitCode
}
finally {
    Pop-Location
}
