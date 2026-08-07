# RIFT ARK generated image set

Source brief: `docs/05-art-briefs/40-image-production-brief.md`

## Inventory

| Group | Count | Location |
|---|---:|---|
| World backgrounds | 40 | `backgrounds/` |
| Ark and rift structures | 5 | `structures/` |
| UI kit | 41 | `ui/` |
| Store images | 40 | `store/` |
| Total | 126 | `asset/generated/` |

The rift files are horizontal eight-frame strips. Store images include eight Play screenshots and the corresponding 24 iOS size variants.

## Production modes

- Creative art: generated one asset at a time with the built-in image generation tool.
- Transparent creative art: generated against a chroma-key field, then despilled and converted to PNG alpha locally.
- Exact-size pixel processing: nearest-neighbor resize, four-pixel block treatment, center crop, and mirrored horizontal tile construction with `tools/Normalize-GeneratedImage.ps1`.
- UI, exact Korean/English logotypes, store copy, and market-size derivations: deterministic System.Drawing scripts. Text was not delegated to the image model.

## Final prompt set

The following normalized prompt families describe the final generation inputs. Each creative deliverable was generated separately; layer, world, state, or screenshot variables were substituted per file.

### Backgrounds

> Create one production-ready HD pixel-art parallax layer for the 1280x720 landscape mobile lane-defense game RIFT ARK. Use deliberate chunky 4px pixel clusters, hard edges, dithering instead of smooth gradients, no text, no UI, no characters, and a restrained dark low-saturation palette so units remain readable. Render only the requested `{sky|far|mid|ground}` layer for `{world}`. For Far and Mid, isolate the requested silhouettes or architecture over a clean chroma-key field. For Ground, show three clear horizontal travel lanes with only low debris. Theme objects: `{world objects}`.

World substitutions:

| World | Theme objects |
|---:|---|
| 1 | collapsed sewer, brick arches, sewage, rusted pipes, moss |
| 2 | ashen border village, ruined huts, broken fences, embers, ash |
| 3 | moss swamp, twisted roots, pools, fog, muted reflections |
| 4 | shattered citadel, broken walls, siege wreckage, torn banners |
| 5 | wizard tower, floating stone, runes, circles, suspended books |
| 6 | catacombs, sarcophagi, bones, candles, underground arches |
| 7 | dragon nest, lava, giant eggs, charred rock, heat |
| 8 | abyss, inverted architecture, eye motifs, organic walls |
| 9 | betrayed heaven, ruined columns, cracked halos, fallen statues |
| 10 | rift core, fragments and motifs from worlds 1 through 9 |

### Structures

> Create a single side-on HD pixel-art structure sprite for RIFT ARK on a clean green chroma-key background, hard-edged four-pixel cluster language, no text, no UI, no shadow outside the sprite. `{ark state or rift animation strip}` must read clearly at mobile scale and face into the battlefield.

State substitutions: intact Ark with lit torches and banner; moderately damaged Ark; critically damaged burning Ark; eight-frame idle violet vertical rift; eight-frame larger violent expanded rift.

### Store art

> Create polished dark-fantasy HD pixel art for the landscape mobile lane-defense game RIFT ARK. The visual identity is a rugged Ark fortress facing a luminous violet dimensional rift, with restrained charcoal, iron, dirty gold, and violet colors, chunky hard-edged pixels, no generated text, no logos, and no rounded app-icon mask. Keep the principal silhouette centered and immediately readable at thumbnail size.

This family was used separately for the master icon, adaptive foreground, adaptive background, splash scene, feature graphic, and each screenshot scene.

### Screenshot scenes

1. Three simultaneous horizontal lanes between Ark and rift.
2. Commander-centered golden ability aura across three lanes.
3. Between-wave sigil/build choice screen.
4. Multi-phase boss battle at the rift.
5. Army loadout selection emphasizing six active choices from forty.
6. Ark reconstruction and management view.
7. Armored goose, shield turtle, and helmeted chicken battle lineup.
8. Offline reward chest and accumulated resources view.

Exact Korean copy is applied by `tools/New-StoreScreenshots.ps1` after generation.

## Reproduction and validation

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\New-GeneratedUiKit.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\New-GeneratedStoreArt.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\New-StoreScreenshots.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-GeneratedAssets.ps1
```

`Test-GeneratedAssets.ps1` checks the full 126-file manifest, exact dimensions, alpha-capable versus opaque formats, and exact first/last-column matches for all 30 horizontally tiled layers.

## Final validation

- Validated on 2026-08-02: `Verified 126 generated assets, including 30 seamless layers.`
- Visual spot-check passed for the World 1 sky/ground layers, intact Ark, idle rift strip, representative UI components, app icon, splash, Play feature graphic, and all eight Play screenshot compositions.
- The app icon remains legible as a single Ark-and-rift silhouette, the splash lockup stays inside the central safe area, and the screenshot set has distinct scenes with readable Korean copy.

The store screenshots are production marketing mockups based on the brief. Replace them with final runtime captures before submission if the implemented screens or final unit roster diverge.
