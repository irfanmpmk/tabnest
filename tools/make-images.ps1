# Generates the extension icons and the Chrome Web Store promo tile.
# Run: powershell -ExecutionPolicy Bypass -File tools\make-images.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$iconDir = Join-Path $root 'extension\icons'
$storeDir = Join-Path $root 'store'
New-Item -ItemType Directory -Force $iconDir, $storeDir | Out-Null

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-Graphics($bmp) {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  return $g
}

# Draws the logo (indigo rounded square with three stacked tab cards) into a square area.
function Draw-Logo($g, [float]$ox, [float]$oy, [float]$s) {
  $bg = New-RoundRect $ox $oy $s $s ($s * 0.22)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF($ox, $oy)),
    (New-Object System.Drawing.PointF(($ox + $s), ($oy + $s))),
    [System.Drawing.Color]::FromArgb(255, 124, 108, 255),
    [System.Drawing.Color]::FromArgb(255, 67, 56, 202))
  $g.FillPath($grad, $bg)

  $w = $s * 0.48; $h = $s * 0.34; $r = $s * 0.07
  $cards = @(
    @{ x = 0.34; y = 0.19; a = 110 },
    @{ x = 0.27; y = 0.31; a = 175 },
    @{ x = 0.20; y = 0.43; a = 255 }
  )
  foreach ($c in $cards) {
    $x = $ox + $s * $c.x; $y = $oy + $s * $c.y
    $shadow = New-RoundRect $x ($y + $s * 0.015) $w $h $r
    $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 30, 20, 120))), $shadow)
    $card = New-RoundRect $x $y $w $h $r
    $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($c.a, 255, 255, 255))), $card)
  }
  # Tab strip line on the front card.
  $fx = $ox + $s * 0.20; $fy = $oy + $s * 0.43
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 99, 88, 240), ($s * 0.035))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawLine($pen, ($fx + $w * 0.16), ($fy + $h * 0.30), ($fx + $w * 0.52), ($fy + $h * 0.30))
}

# Master logo at 512px, then scaled down for crisp small icons.
$master = New-Object System.Drawing.Bitmap 512, 512
$g = New-Graphics $master
$g.Clear([System.Drawing.Color]::Transparent)
Draw-Logo $g 0 0 512
$g.Dispose()

foreach ($size in 16, 32, 48) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = New-Graphics $bmp
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($master, 0, 0, $size, $size)
  $g.Dispose()
  $bmp.Save((Join-Path $iconDir "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# Store guideline: 128px icon with 96px artwork and 16px transparent padding.
$bmp = New-Object System.Drawing.Bitmap 128, 128
$g = New-Graphics $bmp
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($master, 16, 16, 96, 96)
$g.Dispose()
$bmp.Save((Join-Path $iconDir 'icon128.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

# Small promo tile, 440x280.
$tile = New-Object System.Drawing.Bitmap 440, 280
$g = New-Graphics $tile
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)), (New-Object System.Drawing.Point(440, 280)),
  [System.Drawing.Color]::FromArgb(255, 30, 27, 75), [System.Drawing.Color]::FromArgb(255, 49, 46, 129))
$g.FillRectangle($grad, 0, 0, 440, 280)
$g.DrawImage($master, 36, 80, 120, 120)
$white = [System.Drawing.Brushes]::White
$soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 199, 210, 254))
$g.DrawString('TabNest', (New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Bold)), $white, 172, 88)
$g.DrawString("Save, search and restore`nyour tabs. 100% private.", (New-Object System.Drawing.Font('Segoe UI', 13)), $soft, 176, 140)
$g.Dispose()
$tile.Save((Join-Path $storeDir 'promo-small-440x280.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$tile.Dispose()
$master.Dispose()

Write-Host "Icons written to $iconDir"
Write-Host "Promo tile written to $storeDir"
