Set-Location "C:/Users/OS/Desktop/Zerohook"
mkdir -Force mobile/android/artifacts | Out-Null
$apk = Get-ChildItem -Path mobile/android/app/build/outputs/apk -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { Write-Host "NO_APK"; exit 2 }
Write-Host "APK: $($apk.FullName)"
$devs = adb devices -l | Select-String -Pattern '^([0-9A-Fa-f]+)\s+device' -AllMatches
if (-not $devs) { Write-Host "NO_DEVICE"; exit 3 }
$serial = ($devs.Matches | Select-Object -First 1).Groups[1].Value
Write-Host "DEVICE: $serial"
adb -s $serial install -r "$($apk.FullName)" | Out-Host
Start-Sleep -Seconds 1
adb -s $serial shell input keyevent 224; Start-Sleep -Milliseconds 700
adb -s $serial shell wm dismiss-keyguard; Start-Sleep -Milliseconds 700
adb -s $serial shell input keyevent 82; Start-Sleep -Milliseconds 700
adb -s $serial shell am start -n com.zerohook.app/.MainActivity | Out-Host
Start-Sleep -Seconds 1
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tabs = @(@{Name='browse';X=98;Y=2092}, @{Name='services';X=318;Y=2092}, @{Name='messages';X=539;Y=2092}, @{Name='wallet';X=760;Y=2092}, @{Name='profile';X=981;Y=2092})
foreach ($t in $tabs) {
  $base = "zerohook-pass2-$stamp-$serial-$($t.Name)"
  Write-Host "TAP $($t.Name)"
  adb -s $serial shell input tap $($t.X) $($t.Y); Start-Sleep -Milliseconds 900
  adb -s $serial shell screencap -p "/sdcard/$base.png" | Out-Host
  adb -s $serial pull "/sdcard/$base.png" "mobile/android/artifacts/$base.png" | Out-Host
  adb -s $serial shell uiautomator dump "/sdcard/$base.xml" | Out-Host
  adb -s $serial pull "/sdcard/$base.xml" "mobile/android/artifacts/$base.xml" | Out-Host
}
Write-Host "=== ARTIFACT LIST ==="
Get-ChildItem "mobile/android/artifacts" -File | Sort-Object LastWriteTime -Descending | ForEach-Object {
  if ($_.Extension -ieq '.png') {
    $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.Substring(0,16)
    Write-Host "$($_.Name) 	$($_.Length) 	$h"
  } else {
    Write-Host "$($_.Name) 	$($_.Length)"
  }
}
Write-Host "DONE"
