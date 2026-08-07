param(
  [string]$Root = (Join-Path $PSScriptRoot '..\asset\generated')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$expected = @{
  'backgrounds' = @{}
  'structures' = @{
    'ark-100.png' = @(160, 480)
    'ark-66.png' = @(160, 480)
    'ark-33.png' = @(160, 480)
    'rift-idle.png' = @(1536, 480)
    'rift-expanded.png' = @(2048, 560)
  }
  'ui' = @{}
  'store' = @{
    'icon.png' = @(1024, 1024)
    'icon-foreground.png' = @(1024, 1024)
    'icon-background.png' = @(1024, 1024)
    'splash.png' = @(2732, 2732)
    'logo-ko.png' = @(1024, 512)
    'logo-en.png' = @(1024, 512)
    'logo-lockup.png' = @(1024, 640)
    'play-feature-graphic.png' = @(1024, 500)
  }
}

foreach ($world in 1..10) {
  $expected.backgrounds["w$world-sky.png"] = @(1280, 720)
  $expected.backgrounds["w$world-far.png"] = @(1280, 480)
  $expected.backgrounds["w$world-mid.png"] = @(1280, 400)
  $expected.backgrounds["w$world-ground.png"] = @(1280, 240)
}

foreach ($name in 'panel-base', 'panel-dark', 'panel-accent') {
  $expected.ui["$name.png"] = @(48, 48)
}
foreach ($kind in 'primary', 'secondary', 'danger') {
  foreach ($state in 'normal', 'pressed', 'disabled', 'glow') {
    $expected.ui["btn-$kind-$state.png"] = @(48, 24)
  }
}
foreach ($name in 'empty', 'l', 'c', 'r', 'e') {
  $expected.ui["slot-$name.png"] = @(32, 32)
}
foreach ($kind in 'hp', 'mana', 'rift', 'exp') {
  foreach ($part in 'track', 'fill') {
    $expected.ui["bar-$kind-$part.png"] = @(32, 8)
  }
}
foreach ($name in 'star-on', 'star-off') {
  $expected.ui["$name.png"] = @(16, 16)
}
foreach ($name in 'physical', 'holy', 'arcane') {
  $expected.ui["dmg-$name.png"] = @(12, 12)
}
foreach ($name in 'armored', 'flying', 'swarm', 'shielded', 'regen', 'warded', 'corrupt', 'living') {
  $expected.ui["tag-$name.png"] = @(8, 8)
}

foreach ($index in 1..8) {
  $expected.store["play-screenshot-$index.png"] = @(1920, 1080)
  $expected.store["ios-6.9-$index.png"] = @(2868, 1320)
  $expected.store["ios-6.5-$index.png"] = @(2778, 1284)
  $expected.store["ios-ipad-$index.png"] = @(2732, 2048)
}

$alphaAssets = [System.Collections.Generic.HashSet[string]]::new(
  [System.StringComparer]::OrdinalIgnoreCase
)
foreach ($name in $expected.structures.Keys) {
  [void]$alphaAssets.Add("structures/$name")
}
foreach ($name in $expected.ui.Keys) {
  [void]$alphaAssets.Add("ui/$name")
}
foreach ($world in 1..10) {
  [void]$alphaAssets.Add("backgrounds/w$world-far.png")
  [void]$alphaAssets.Add("backgrounds/w$world-mid.png")
}
foreach ($name in 'icon-foreground.png', 'logo-ko.png', 'logo-en.png', 'logo-lockup.png') {
  [void]$alphaAssets.Add("store/$name")
}

$failures = [System.Collections.Generic.List[string]]::new()
$verified = 0
$seamChecked = 0

foreach ($folder in $expected.Keys) {
  foreach ($entry in $expected[$folder].GetEnumerator()) {
    $relativePath = "$folder/$($entry.Key)"
    $path = Join-Path $Root (Join-Path $folder $entry.Key)
    if (-not (Test-Path $path)) {
      $failures.Add("MISSING $relativePath")
      continue
    }

    $image = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
    try {
      if ($image.Width -ne $entry.Value[0] -or $image.Height -ne $entry.Value[1]) {
        $failures.Add(
          "SIZE ${relativePath}: $($image.Width)x$($image.Height), expected $($entry.Value[0])x$($entry.Value[1])"
        )
        continue
      }

      $hasAlpha = [System.Drawing.Image]::IsAlphaPixelFormat($image.PixelFormat)
      if ($alphaAssets.Contains($relativePath) -and -not $hasAlpha) {
        $failures.Add("ALPHA ${relativePath}: expected an alpha-capable pixel format")
      }
      if (-not $alphaAssets.Contains($relativePath) -and $hasAlpha) {
        $failures.Add("OPAQUE ${relativePath}: expected an opaque pixel format")
      }

      if ($folder -eq 'backgrounds' -and $entry.Key -notlike '*-sky.png') {
        $isSeamless = $true
        foreach ($y in 0..($image.Height - 1)) {
          if ($image.GetPixel(0, $y).ToArgb() -ne $image.GetPixel($image.Width - 1, $y).ToArgb()) {
            $isSeamless = $false
            break
          }
        }
        if (-not $isSeamless) {
          $failures.Add("SEAM ${relativePath}: first and last columns differ")
        } else {
          $seamChecked += 1
        }
      }

      $verified += 1
    } finally {
      $image.Dispose()
    }
  }
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  exit 1
}

Write-Host "Verified $verified generated assets, including $seamChecked seamless layers."
