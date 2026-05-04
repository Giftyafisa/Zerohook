$serial='110436441C000733'
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tabs = @(@{Name='browse';X=98;Y=2092}, @{Name='services';X=318;Y=2092}, @{Name='messages';X=539;Y=2092}, @{Name='wallet';X=760;Y=2092}, @{Name='profile';X=981;Y=2092})
Write-Host "=== QA PASS 3: FRESH BUILD ==="
Write-Host "Timestamp: $stamp | Device: $serial"
foreach ($t in $tabs) {
  $base = "zerohook-pass3-$stamp-$serial-$($t.Name)"
  Write-Host "TAP $($t.Name)"
  adb -s $serial shell input tap $($t.X) $($t.Y); Start-Sleep -Milliseconds 800
  adb -s $serial shell screencap -p "/sdcard/$base.png" 2>&1 | Out-Host
  adb -s $serial pull "/sdcard/$base.png" "mobile/android/artifacts/$base.png" 2>&1 | Out-Host
  if (Test-Path "mobile/android/artifacts/$base.png") {
    $h = (Get-FileHash "mobile/android/artifacts/$base.png" -Algorithm SHA256).Hash.Substring(0,16)
    Write-Host "$($base.png) → $h"
  }
}
Write-Host "=== ARTIFACTS COMPLETE ==="
Get-ChildItem "mobile/android/artifacts" -Filter "zerohook-pass3*" -File | Format-Table Name,Length -AutoSize
