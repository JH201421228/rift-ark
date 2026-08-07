param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\asset\generated\ui')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutputRoot | Out-Null

function Color([string]$Hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-Art([int]$Width, [int]$Height, [string]$Background = $null) {
  $bitmap = [System.Drawing.Bitmap]::new(
    $Width,
    $Height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear($(if ($Background) { Color $Background } else { [System.Drawing.Color]::Transparent }))
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

function Fill-Rect(
  [System.Drawing.Bitmap]$Bitmap,
  [int]$X,
  [int]$Y,
  [int]$Width,
  [int]$Height,
  [string]$Hex
) {
  $x0 = [Math]::Max(0, $X)
  $y0 = [Math]::Max(0, $Y)
  $x1 = [Math]::Min($Bitmap.Width, $X + $Width)
  $y1 = [Math]::Min($Bitmap.Height, $Y + $Height)
  $pixel = Color $Hex
  for ($yPos = $y0; $yPos -lt $y1; $yPos += 1) {
    for ($xPos = $x0; $xPos -lt $x1; $xPos += 1) {
      $Bitmap.SetPixel($xPos, $yPos, $pixel)
    }
  }
}

function Save-Art([System.Drawing.Bitmap]$Bitmap, [string]$Name) {
  try {
    $Bitmap.Save((Join-Path $OutputRoot $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $Bitmap.Dispose()
  }
}

function New-Panel([string]$Name, [string]$Outer, [string]$Edge, [string]$Inner, [string]$Highlight) {
  $art = New-Art 48 48
  Fill-Rect $art 0 0 48 48 $Outer
  Fill-Rect $art 2 2 44 44 $Edge
  Fill-Rect $art 4 4 40 40 $Outer
  Fill-Rect $art 6 6 36 36 $Inner
  Fill-Rect $art 8 8 32 32 '#141522'
  Fill-Rect $art 2 2 8 2 $Highlight
  Fill-Rect $art 38 2 8 2 $Highlight
  Fill-Rect $art 2 44 8 2 '#080910'
  Fill-Rect $art 38 44 8 2 '#080910'
  foreach ($offset in 12, 20, 28, 36) {
    Fill-Rect $art $offset 2 4 2 $Highlight
    Fill-Rect $art $offset 44 4 2 $Outer
    Fill-Rect $art 2 $offset 2 4 $Highlight
    Fill-Rect $art 44 $offset 2 4 $Outer
  }
  Save-Art $art $Name
}

function New-Button(
  [string]$Name,
  [string]$Base,
  [string]$Light,
  [string]$Dark,
  [string]$State
) {
  $art = New-Art 48 24
  if ($State -eq 'glow') {
    Fill-Rect $art 0 4 48 16 $Light
    Fill-Rect $art 4 0 40 24 $Light
  }

  $offset = if ($State -eq 'pressed') { 2 } else { 0 }
  $disabled = $State -eq 'disabled'
  $outer = if ($disabled) { '#30313a' } else { '#0a0b12' }
  $body = if ($disabled) { '#50515a' } else { $Base }
  $top = if ($disabled) { '#666772' } else { $Light }
  $bottom = if ($disabled) { '#292a31' } else { $Dark }

  Fill-Rect $art 4 (2 + $offset) 40 20 $outer
  Fill-Rect $art 2 (6 + $offset) 44 12 $outer
  Fill-Rect $art 5 (4 + $offset) 38 16 $body
  Fill-Rect $art 4 (7 + $offset) 40 10 $body
  Fill-Rect $art 6 (5 + $offset) 36 3 $top
  Fill-Rect $art 6 (17 + $offset) 36 2 $bottom
  Fill-Rect $art 7 (8 + $offset) 34 2 $top
  Save-Art $art $Name
}

function New-Slot([string]$Name, [string]$Rank, [string]$Tint) {
  $art = New-Art 32 32
  Fill-Rect $art 2 2 28 28 '#080910'
  Fill-Rect $art 4 4 24 24 '#1a1b28'

  if ($Rank -eq 'empty') {
    foreach ($p in 4, 10, 16, 22) {
      Fill-Rect $art $p 2 4 2 '#6a6b73'
      Fill-Rect $art $p 28 4 2 '#6a6b73'
      Fill-Rect $art 2 $p 2 4 '#6a6b73'
      Fill-Rect $art 28 $p 2 4 '#6a6b73'
    }
  } else {
    Fill-Rect $art 4 2 24 2 $Tint
    Fill-Rect $art 4 28 24 2 $Tint
    Fill-Rect $art 2 4 2 24 $Tint
    Fill-Rect $art 28 4 2 24 $Tint
  }

  if ($Rank -in @('r', 'e', 'l')) {
    Fill-Rect $art 0 4 4 6 $Tint
    Fill-Rect $art 28 4 4 6 $Tint
    Fill-Rect $art 0 22 4 6 $Tint
    Fill-Rect $art 28 22 4 6 $Tint
  }
  if ($Rank -in @('e', 'l')) {
    Fill-Rect $art 8 0 4 4 $Tint
    Fill-Rect $art 20 0 4 4 $Tint
    Fill-Rect $art 8 28 4 4 $Tint
    Fill-Rect $art 20 28 4 4 $Tint
  }
  if ($Rank -eq 'l') {
    Fill-Rect $art 14 0 4 6 $Tint
    Fill-Rect $art 14 26 4 6 $Tint
    Fill-Rect $art 0 14 6 4 $Tint
    Fill-Rect $art 26 14 6 4 $Tint
    Fill-Rect $art 6 6 3 3 '#fff2b0'
    Fill-Rect $art 23 6 3 3 '#fff2b0'
  }
  Save-Art $art $Name
}

function New-BarPair([string]$Name, [string]$Tint, [string]$Light, [string]$Dark) {
  $track = New-Art 32 8
  Fill-Rect $track 0 2 32 4 '#080910'
  Fill-Rect $track 2 0 28 8 '#080910'
  Fill-Rect $track 2 2 28 4 '#242532'
  Fill-Rect $track 4 3 24 2 '#151620'
  Save-Art $track "bar-$Name-track.png"

  $fill = New-Art 32 8
  Fill-Rect $fill 0 2 32 4 $Dark
  Fill-Rect $fill 2 0 28 8 $Dark
  Fill-Rect $fill 2 2 28 4 $Tint
  Fill-Rect $fill 4 2 24 2 $Light
  Save-Art $fill "bar-$Name-fill.png"
}

New-Panel 'panel-base.png' '#090a12' '#343746' '#252735' '#596074'
New-Panel 'panel-accent.png' '#16110a' '#8a6022' '#322716' '#f2b33d'
New-Panel 'panel-dark.png' '#05060b' '#20212c' '#10111b' '#353746'

$buttonFamilies = @(
  @{ Name = 'primary'; Base = '#b47b26'; Light = '#f2b33d'; Dark = '#6f4318' },
  @{ Name = 'secondary'; Base = '#394a66'; Light = '#6683a6'; Dark = '#202a3d' },
  @{ Name = 'danger'; Base = '#7d2834'; Light = '#d4525f'; Dark = '#43151d' }
)
foreach ($family in $buttonFamilies) {
  foreach ($state in 'normal', 'pressed', 'disabled', 'glow') {
    New-Button "btn-$($family.Name)-$state.png" $family.Base $family.Light $family.Dark $state
  }
}

New-Slot 'slot-empty.png' 'empty' '#6a6b73'
New-Slot 'slot-c.png' 'c' '#b8b8b8'
New-Slot 'slot-r.png' 'r' '#4a9ee0'
New-Slot 'slot-e.png' 'e' '#b45ad6'
New-Slot 'slot-l.png' 'l' '#f2b33d'

New-BarPair 'hp' '#b83a47' '#f06a73' '#611c27'
New-BarPair 'mana' '#3679bd' '#6db4ed' '#1b3f68'
New-BarPair 'rift' '#8a42a6' '#cf74e8' '#442052'
New-BarPair 'exp' '#c78c2a' '#f5c35f' '#6d4516'

$starOn = New-Art 16 16
Fill-Rect $starOn 6 0 4 4 '#fff2b0'
Fill-Rect $starOn 4 4 8 4 '#f2b33d'
Fill-Rect $starOn 0 6 16 4 '#f2b33d'
Fill-Rect $starOn 4 8 8 4 '#f2b33d'
Fill-Rect $starOn 2 10 4 4 '#c57b24'
Fill-Rect $starOn 10 10 4 4 '#c57b24'
Fill-Rect $starOn 7 4 2 5 '#fff2b0'
Save-Art $starOn 'star-on.png'

$starOff = New-Art 16 16
Fill-Rect $starOff 6 0 4 4 '#555661'
Fill-Rect $starOff 4 4 8 4 '#555661'
Fill-Rect $starOff 0 6 16 4 '#555661'
Fill-Rect $starOff 4 8 8 4 '#383943'
Fill-Rect $starOff 2 10 4 4 '#383943'
Fill-Rect $starOff 10 10 4 4 '#383943'
Save-Art $starOff 'star-off.png'

$physical = New-Art 12 12
Fill-Rect $physical 8 0 2 2 '#dfe2e8'
Fill-Rect $physical 6 2 2 4 '#dfe2e8'
Fill-Rect $physical 4 5 2 4 '#aeb3bf'
Fill-Rect $physical 2 8 6 2 '#dfe2e8'
Fill-Rect $physical 1 10 3 2 '#7d8493'
Save-Art $physical 'dmg-physical.png'

$arcane = New-Art 12 12
Fill-Rect $arcane 4 0 4 2 '#d989ef'
Fill-Rect $arcane 2 2 2 6 '#9e50be'
Fill-Rect $arcane 8 2 2 4 '#d989ef'
Fill-Rect $arcane 4 6 6 2 '#9e50be'
Fill-Rect $arcane 6 4 2 2 '#f2c4ff'
Fill-Rect $arcane 4 8 2 4 '#d989ef'
Save-Art $arcane 'dmg-arcane.png'

$holy = New-Art 12 12
Fill-Rect $holy 5 0 2 12 '#fff2b0'
Fill-Rect $holy 1 4 10 2 '#f2b33d'
Fill-Rect $holy 3 2 6 6 '#fff2b0'
Fill-Rect $holy 5 0 2 12 '#fff8d8'
Save-Art $holy 'dmg-holy.png'

function New-Tag([string]$Name, [scriptblock]$Draw) {
  $art = New-Art 8 8
  & $Draw $art
  Save-Art $art "tag-$Name.png"
}

$tag = '#f0e8d2'
New-Tag 'armored' { param($a) Fill-Rect $a 1 0 6 2 $tag; Fill-Rect $a 0 2 8 3 $tag; Fill-Rect $a 2 5 4 2 $tag; Fill-Rect $a 3 7 2 1 $tag; Fill-Rect $a 2 2 4 2 '#50515a' }
New-Tag 'warded' { param($a) Fill-Rect $a 2 0 4 1 '#7bd6ff'; Fill-Rect $a 1 1 6 1 '#7bd6ff'; Fill-Rect $a 0 2 2 4 '#7bd6ff'; Fill-Rect $a 6 2 2 4 '#7bd6ff'; Fill-Rect $a 2 6 4 2 '#7bd6ff' }
New-Tag 'flying' { param($a) Fill-Rect $a 0 1 2 4 $tag; Fill-Rect $a 2 3 2 3 $tag; Fill-Rect $a 4 3 2 3 $tag; Fill-Rect $a 6 1 2 4 $tag; Fill-Rect $a 3 5 2 3 '#9ca3b5' }
New-Tag 'swarm' { param($a) Fill-Rect $a 0 3 2 2 '#f2b33d'; Fill-Rect $a 3 1 2 2 '#f2b33d'; Fill-Rect $a 6 4 2 2 '#f2b33d'; Fill-Rect $a 3 6 2 2 '#f2b33d' }
New-Tag 'corrupt' { param($a) Fill-Rect $a 1 0 6 1 '#d672df'; Fill-Rect $a 0 1 8 4 '#d672df'; Fill-Rect $a 2 5 4 2 '#d672df'; Fill-Rect $a 1 2 2 2 '#17131f'; Fill-Rect $a 5 2 2 2 '#17131f'; Fill-Rect $a 3 5 1 3 '#17131f'; Fill-Rect $a 5 5 1 3 '#17131f' }
New-Tag 'living' { param($a) Fill-Rect $a 0 1 3 3 '#e05a64'; Fill-Rect $a 5 1 3 3 '#e05a64'; Fill-Rect $a 1 3 6 3 '#e05a64'; Fill-Rect $a 2 6 4 1 '#e05a64'; Fill-Rect $a 3 7 2 1 '#e05a64' }
New-Tag 'shielded' { param($a) Fill-Rect $a 1 0 5 1 '#d6d9e2'; Fill-Rect $a 0 1 2 6 '#d6d9e2'; Fill-Rect $a 1 7 5 1 '#d6d9e2'; Fill-Rect $a 5 1 2 6 '#d6d9e2'; Fill-Rect $a 3 2 5 1 '#7db6ee'; Fill-Rect $a 3 3 1 4 '#7db6ee'; Fill-Rect $a 4 6 4 1 '#7db6ee'; Fill-Rect $a 7 2 1 5 '#7db6ee' }
New-Tag 'regen' { param($a) Fill-Rect $a 3 0 2 5 '#65d67c'; Fill-Rect $a 1 2 6 2 '#65d67c'; Fill-Rect $a 2 5 4 1 '#d8f5dc'; Fill-Rect $a 1 6 2 2 '#d8f5dc'; Fill-Rect $a 5 6 2 2 '#d8f5dc' }

Write-Host 'Generated 41 UI kit images.'
