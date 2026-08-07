param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\asset\generated\store')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutputRoot | Out-Null

function New-Bitmap([int]$Width, [int]$Height, [bool]$Opaque = $false) {
  $format = if ($Opaque) {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  } else {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  }
  return [System.Drawing.Bitmap]::new($Width, $Height, $format)
}

function Draw-CenteredText(
  [System.Drawing.Graphics]$Graphics,
  [string]$Text,
  [System.Drawing.Font]$Font,
  [single]$CenterX,
  [single]$Y,
  [string]$Color
) {
  $size = $Graphics.MeasureString($Text, $Font)
  $x = $CenterX - ($size.Width / 2.0)
  $outline = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#100d18'))
  $fill = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($Color))
  try {
    foreach ($offset in @(@(-2, 0), @(2, 0), @(0, -2), @(0, 2), @(-1, -1), @(1, 1))) {
      $Graphics.DrawString($Text, $Font, $outline, [single]($x + $offset[0]), [single]($Y + $offset[1]))
    }
    $Graphics.DrawString($Text, $Font, $fill, [single]$x, $Y)
  } finally {
    $outline.Dispose()
    $fill.Dispose()
  }
}

function Add-RiftMark([System.Drawing.Bitmap]$Bitmap, [int]$CenterX, [int]$Top, [int]$Height) {
  $light = [System.Drawing.ColorTranslator]::FromHtml('#d989ef')
  $dark = [System.Drawing.ColorTranslator]::FromHtml('#7c3b98')
  $half = [Math]::Floor($Height / 2)
  for ($y = 0; $y -lt $Height; $y += 1) {
    $distance = [Math]::Abs($half - $y)
    $width = [Math]::Max(1, [Math]::Floor(($half - $distance) / 5) + 1)
    $jag = if (($y % 5) -eq 0) { 1 } else { 0 }
    for ($x = -$width - $jag; $x -le $width; $x += 1) {
      $color = if ([Math]::Abs($x) -le 0) { $light } else { $dark }
      $px = $CenterX + $x
      $py = $Top + $y
      if ($px -ge 0 -and $px -lt $Bitmap.Width -and $py -ge 0 -and $py -lt $Bitmap.Height) {
        $Bitmap.SetPixel($px, $py, $color)
      }
    }
  }
}

function Resize-Nearest([System.Drawing.Image]$Source, [int]$Width, [int]$Height, [bool]$Opaque = $false) {
  $bitmap = New-Bitmap $Width $Height $Opaque
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear($(if ($Opaque) { [System.Drawing.ColorTranslator]::FromHtml('#0f0f1e') } else { [System.Drawing.Color]::Transparent }))
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.DrawImage($Source, [System.Drawing.Rectangle]::new(0, 0, $Width, $Height))
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

function New-Logo([string]$Name, [string]$Mode, [int]$FinalHeight) {
  $logicalHeight = [Math]::Floor($FinalHeight / 4)
  $logical = New-Bitmap 256 $logicalHeight
  $graphics = [System.Drawing.Graphics]::FromImage($logical)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit

    if ($Mode -eq 'ko') {
      $font = [System.Drawing.Font]::new('Malgun Gothic', 28, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      try {
        Add-RiftMark $logical 128 8 22
        Draw-CenteredText $graphics '균열의 방주' $font 128 36 '#f2b33d'
      } finally {
        $font.Dispose()
      }
    } elseif ($Mode -eq 'en') {
      $font = [System.Drawing.Font]::new('Arial Black', 32, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      try {
        Add-RiftMark $logical 128 8 22
        Draw-CenteredText $graphics 'RIFT ARK' $font 128 36 '#f2b33d'
      } finally {
        $font.Dispose()
      }
    } else {
      $koFont = [System.Drawing.Font]::new('Malgun Gothic', 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $enFont = [System.Drawing.Font]::new('Arial Black', 21, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      try {
        Add-RiftMark $logical 128 6 20
        Draw-CenteredText $graphics '균열의 방주' $koFont 128 30 '#f2b33d'
        Draw-CenteredText $graphics 'RIFT ARK' $enFont 128 83 '#b45ad6'
      } finally {
        $koFont.Dispose()
        $enFont.Dispose()
      }
    }
  } finally {
    $graphics.Dispose()
  }

  try {
    $final = Resize-Nearest $logical 1024 $FinalHeight
    try {
      $final.Save((Join-Path $OutputRoot $Name), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $final.Dispose()
    }
  } finally {
    $logical.Dispose()
  }
}

New-Logo 'logo-ko.png' 'ko' 512
New-Logo 'logo-en.png' 'en' 512
New-Logo 'logo-lockup.png' 'lockup' 640

$splash = New-Bitmap 2732 2732 $true
$graphics = [System.Drawing.Graphics]::FromImage($splash)
try {
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#0f0f1e'))
  $logo = [System.Drawing.Image]::FromFile((Join-Path $OutputRoot 'logo-lockup.png'))
  try {
    $targetWidth = 1024
    $targetHeight = 640
    $x = [Math]::Floor((2732 - $targetWidth) / 2)
    $y = [Math]::Floor((2732 - $targetHeight) / 2)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.DrawImage($logo, [System.Drawing.Rectangle]::new($x, $y, $targetWidth, $targetHeight))
  } finally {
    $logo.Dispose()
  }
  $splash.Save((Join-Path $OutputRoot 'splash.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $splash.Dispose()
}

Write-Host 'Generated three logos and the splash image.'
