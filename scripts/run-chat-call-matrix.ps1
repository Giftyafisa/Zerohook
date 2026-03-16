param(
    [switch]$ForceAndroidWithoutGoogleServices
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$serverRoot = Join-Path $repoRoot "server"
$androidRoot = Join-Path $repoRoot "mobile/android"

Write-Output "[matrix] Repo root: $repoRoot"

$googleServicesCandidates = @(
    (Join-Path $androidRoot "app/google-services.json"),
    (Join-Path $androidRoot "app/src/debug/google-services.json"),
    (Join-Path $androidRoot "app/src/release/google-services.json")
)
$googleServicesPath = $googleServicesCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$hasGoogleServices = [bool]$googleServicesPath

Write-Output "[matrix] google-services present: $hasGoogleServices"
if ($hasGoogleServices) {
    Write-Output "[matrix] google-services path: $googleServicesPath"
}

Push-Location $repoRoot
try {
    Write-Output "[matrix] Server syntax checks"
    node --check server/index.js
    node --check server/routes/chat.js
    node --check server/routes/calls.js

    Write-Output "[matrix] Server targeted tests"
    Push-Location $serverRoot
    try {
        npx jest tests/inferMessageType.test.js --runInBand
        npx jest tests/conversationService.test.js --runInBand
    } finally {
        Pop-Location
    }

    if (-not $hasGoogleServices -and -not $ForceAndroidWithoutGoogleServices) {
        Write-Output "[matrix] Skipping full Android matrix: google-services.json not found."
        Write-Output "[matrix] To run full matrix, add google-services.json and rerun this script."
        exit 2
    }

    Write-Output "[matrix] Android compile and package checks"
    & (Join-Path $androidRoot "gradlew.bat") -p $androidRoot :app:compileDebugKotlin -x lint --no-daemon --console=plain
    & (Join-Path $androidRoot "gradlew.bat") -p $androidRoot :app:assembleDebug -x lint --no-daemon --console=plain

    Write-Output "[matrix] Completed successfully"
} finally {
    Pop-Location
}
