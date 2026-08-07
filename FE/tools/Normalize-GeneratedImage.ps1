param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [int]$Width,

  [Parameter(Mandatory = $true)]
  [int]$Height,

  [ValidateRange(1, 32)]
  [int]$BlockSize = 1,

  [ValidateRange(0.1, 1.5)]
  [double]$Brightness = 1.0,

  [ValidateRange(0.1, 1.0)]
  [double]$ContentScale = 1.0,

  [switch]$Stretch,

  [switch]$SeamlessX,

  [switch]$Opaque,

  [string]$Background = '#0f0f1e'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-Bitmap([int]$BitmapWidth, [int]$BitmapHeight, [bool]$UseAlpha) {
  $format = if ($UseAlpha) {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  } else {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  }

  return [System.Drawing.Bitmap]::new($BitmapWidth, $BitmapHeight, $format)
}

function Draw-Nearest(
  [System.Drawing.Image]$Source,
  [System.Drawing.Bitmap]$Destination,
  [System.Drawing.RectangleF]$SourceRect,
  [System.Drawing.Color]$ClearColor
) {
  $graphics = [System.Drawing.Graphics]::FromImage($Destination)
  try {
    $graphics.Clear($ClearColor)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.DrawImage(
      $Source,
      [System.Drawing.Rectangle]::new(0, 0, $Destination.Width, $Destination.Height),
      $SourceRect.X,
      $SourceRect.Y,
      $SourceRect.Width,
      $SourceRect.Height,
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $graphics.Dispose()
  }
}

$input = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
try {
  if ($Stretch) {
    $cropWidth = [double]$input.Width
    $cropHeight = [double]$input.Height
    $cropX = 0.0
    $cropY = 0.0
  } else {
    $targetAspect = $Width / [double]$Height
    $sourceAspect = $input.Width / [double]$input.Height

    if ($sourceAspect -gt $targetAspect) {
      $cropHeight = [double]$input.Height
      $cropWidth = $cropHeight * $targetAspect
      $cropX = ($input.Width - $cropWidth) / 2.0
      $cropY = 0.0
    } else {
      $cropWidth = [double]$input.Width
      $cropHeight = $cropWidth / $targetAspect
      $cropX = 0.0
      $cropY = ($input.Height - $cropHeight) / 2.0
    }
  }

  $sourceRect = [System.Drawing.RectangleF]::new(
    [single]$cropX,
    [single]$cropY,
    [single]$cropWidth,
    [single]$cropHeight
  )

  $logicalWidth = [Math]::Ceiling($Width / [double]$BlockSize)
  $logicalHeight = [Math]::Ceiling($Height / [double]$BlockSize)
  $useAlpha = -not $Opaque
  $clearColor = if ($Opaque) {
    [System.Drawing.ColorTranslator]::FromHtml($Background)
  } else {
    [System.Drawing.Color]::Transparent
  }

  $sourceWidth = if ($SeamlessX) { [Math]::Ceiling($logicalWidth / 2.0) } else { $logicalWidth }
  $sourceLogical = New-Bitmap $sourceWidth $logicalHeight $useAlpha
  try {
    Draw-Nearest $input $sourceLogical $sourceRect $clearColor

    if ($SeamlessX) {
      $logical = New-Bitmap $logicalWidth $logicalHeight $useAlpha
      $graphics = [System.Drawing.Graphics]::FromImage($logical)
      try {
        $graphics.Clear($clearColor)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $graphics.DrawImageUnscaled($sourceLogical, 0, 0)

        $mirrored = $sourceLogical.Clone()
        try {
          $mirrored.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
          $graphics.DrawImageUnscaled($mirrored, $sourceWidth, 0)
        } finally {
          $mirrored.Dispose()
        }
      } finally {
        $graphics.Dispose()
      }
    } else {
      $logical = $sourceLogical.Clone()
    }

    $final = New-Bitmap $Width $Height $useAlpha
    try {
      $logicalRect = [System.Drawing.RectangleF]::new(0, 0, $logical.Width, $logical.Height)
      Draw-Nearest $logical $final $logicalRect $clearColor

      if ([Math]::Abs($Brightness - 1.0) -gt 0.001) {
        $graded = New-Bitmap $Width $Height $useAlpha
        $graphics = [System.Drawing.Graphics]::FromImage($graded)
        $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
        try {
          $graphics.Clear($clearColor)
          $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

          $matrix = [System.Drawing.Imaging.ColorMatrix]::new()
          $matrix.Matrix00 = [single]$Brightness
          $matrix.Matrix11 = [single]$Brightness
          $matrix.Matrix22 = [single]$Brightness
          $attributes.SetColorMatrix($matrix)
          $graphics.DrawImage(
            $final,
            [System.Drawing.Rectangle]::new(0, 0, $Width, $Height),
            0,
            0,
            $Width,
            $Height,
            [System.Drawing.GraphicsUnit]::Pixel,
            $attributes
          )
        } finally {
          $attributes.Dispose()
          $graphics.Dispose()
        }

        $final.Dispose()
        $final = $graded
      }

      if ([Math]::Abs($ContentScale - 1.0) -gt 0.001) {
        $scaledCanvas = New-Bitmap $Width $Height $useAlpha
        $graphics = [System.Drawing.Graphics]::FromImage($scaledCanvas)
        try {
          $graphics.Clear($clearColor)
          $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
          $scaledWidth = [Math]::Max(1, [Math]::Round($Width * $ContentScale))
          $scaledHeight = [Math]::Max(1, [Math]::Round($Height * $ContentScale))
          $offsetX = [Math]::Floor(($Width - $scaledWidth) / 2.0)
          $offsetY = [Math]::Floor(($Height - $scaledHeight) / 2.0)
          $graphics.DrawImage(
            $final,
            [System.Drawing.Rectangle]::new($offsetX, $offsetY, $scaledWidth, $scaledHeight),
            0,
            0,
            $Width,
            $Height,
            [System.Drawing.GraphicsUnit]::Pixel
          )
        } finally {
          $graphics.Dispose()
        }

        $final.Dispose()
        $final = $scaledCanvas
      }

      $outputDirectory = Split-Path -Parent $OutputPath
      if ($outputDirectory) {
        New-Item -ItemType Directory -Force $outputDirectory | Out-Null
      }
      $final.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $final.Dispose()
    }
  } finally {
    if ($null -ne $logical) {
      $logical.Dispose()
    }
    $sourceLogical.Dispose()
  }
} finally {
  $input.Dispose()
}
