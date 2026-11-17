# Saves the shop as picture(s) without screenshotting by hand.
#   .\snap.ps1              -> 1 picture, or 2 if it is very tall
#   .\snap.ps1 -Parts 1     -> always 1 long picture
#   .\snap.ps1 -Parts 2     -> always split into 2 pictures
#   .\snap.ps1 -Width 1400  -> page width in pixels (default 1600)
# Uses the last SAVED items.js (press 💾 บันทึก in the shop first).
param(
  [ValidateSet('auto', '1', '2')] [string]$Parts = 'auto',
  [int]$Width = 1600,
  [switch]$NoOpen
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'ไม่พบ Edge หรือ Chrome ในเครื่อง' }

$outDir = Join-Path $root 'screenshots'
New-Item -ItemType Directory -Force $outDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$raw = Join-Path $env:TEMP "tr-shop-raw-$stamp.png"
$profileDir = Join-Path $env:TEMP 'tr-shop-snap-profile'
$url = 'file:///' + ((Join-Path $root 'shop.html') -replace '\\', '/') + '?screenshot'

Write-Host '📷 กำลังสร้างรูปร้าน...'
# very tall window so the whole page fits; the empty bottom is trimmed below
$browserArgs = @('--headless=new', '--disable-gpu', '--hide-scrollbars', "--user-data-dir=`"$profileDir`"",
  "--window-size=$Width,12000", '--virtual-time-budget=5000', "--screenshot=`"$raw`"", "`"$url`"")
Start-Process -FilePath $browser -ArgumentList $browserArgs -Wait -WindowStyle Hidden
if (-not (Test-Path $raw)) { throw 'สร้างรูปไม่สำเร็จ' }

$img = [System.Drawing.Bitmap]::FromFile($raw)
$bg = $img.GetPixel(2, $img.Height - 2)   # page background colour
function Is-BlankRow($y) {
  for ($x = 0; $x -lt $img.Width; $x += 8) {
    $p = $img.GetPixel($x, $y)
    if ([Math]::Abs($p.R - $bg.R) + [Math]::Abs($p.G - $bg.G) + [Math]::Abs($p.B - $bg.B) -gt 12) { return $false }
  }
  return $true
}

# trim the empty space under the last card (big steps first, then back down in small ones)
$bottom = $img.Height - 1
while ($bottom -gt 60 -and (Is-BlankRow $bottom)) { $bottom -= 60 }
$bottom = [Math]::Min($img.Height - 1, $bottom + 60)
while ($bottom -gt 0 -and (Is-BlankRow $bottom)) { $bottom -= 2 }
$height = [Math]::Min($img.Height, $bottom + 16)

$split = ($Parts -eq '2') -or ($Parts -eq 'auto' -and $height -gt [int]($Width * 1.5))
$cuts = @(0)
if ($split) {
  # cut in an empty gap nearest the middle so no card is sliced in half
  $mid = [int]($height / 2); $cut = $mid
  for ($d = 0; $d -lt [int]($height / 3); $d += 2) {
    if (Is-BlankRow ($mid + $d)) { $cut = $mid + $d; break }
    if (Is-BlankRow ($mid - $d)) { $cut = $mid - $d; break }
  }
  $cuts += $cut
}
$cuts += $height

$files = @()
for ($k = 0; $k -lt $cuts.Count - 1; $k++) {
  $top = $cuts[$k]; $h = $cuts[$k + 1] - $top
  $part = New-Object System.Drawing.Bitmap($img.Width, $h)
  $g = [System.Drawing.Graphics]::FromImage($part)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $img.Width, $h)), (New-Object System.Drawing.Rectangle(0, $top, $img.Width, $h)), 'Pixel')
  $g.Dispose()
  $name = if ($cuts.Count -gt 2) { "shop-$stamp-$($k + 1).png" } else { "shop-$stamp.png" }
  $file = Join-Path $outDir $name
  $part.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $part.Dispose()
  $files += $file
}
$img.Dispose()
Remove-Item $raw -ErrorAction SilentlyContinue

Write-Host "✅ เสร็จแล้ว $($files.Count) รูป:"
$files | ForEach-Object { Write-Host "   $_" }
if (-not $NoOpen) { Start-Process explorer.exe $outDir }
