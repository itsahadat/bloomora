# Bloomora — Map & Background Art Prompts

These images replace the last free-pack art in the game: the map's trees, bushes,
fence and the grassy background behind the menu, map and levels.
Same idea as `icon-prompts.md`: make them all in **one tool and one chat** so the style matches.

## Base style — add to the end of every prompt

Match the fruit pieces already in the game (`public/assets/art/strawberry.png`):

```
casual mobile match-3 game art, glossy cartoon style, rounded chunky shapes, thin outline in a darker shade of the object's own color, soft gradient shading, bright white highlight on top-left, vibrant warm saturated colors, cozy cheerful garden mood, no text
```

**Tip:** upload `strawberry.png` (or `rose.png`) as a style reference if your tool allows it.

## 1. Background scene (most important — seen on every screen)

| File | Size | Prompt |
|---|---|---|
| `garden-bg.png` | 2048×1024 PNG, no transparency | a wide, horizontally seamless tileable garden landscape for a game background: soft light-blue sky with fluffy white clouds in the top half, a row of pale, hazy distant round trees and bushes on the horizon, then rolling bright green grassy hills starting about 60% down and filling the bottom 40% with plain grass (no objects at the bottom), gentle sunny light, the left and right edges must line up seamlessly |

The game blurs this behind menus and levels and repeats it sideways on the map,
so **the left and right edges must match**. Keep the bottom part plain grass:
the map path is drawn on top of it.

## 2. Map trees and bushes (transparent PNG)

Each one: a **single object, centered, transparent background, standing on the ground (flat bottom)**,
seen from the front / slightly above.

| File | Size | Prompt |
|---|---|---|
| `tree-round.png` | 512×1024 | a round leafy garden tree with a short brown trunk, big puffy green crown made of soft blobs, a few tiny pink blossoms |
| `tree-tall.png` | 512×1024 | a tall slim poplar-style garden tree, narrow oval green crown, thin brown trunk |
| `tree-pine.png` | 512×1024 | a friendly cartoon pine tree, three rounded layers of green, short brown trunk |
| `tree-small.png` | 256×512 | a small young sapling tree, thin trunk, small round green crown |
| `bush-wide.png` | 512×256 | a wide low flowering bush, rounded green blobs with small pink and yellow flowers |
| `bush-round.png` | 256×256 | a small round green shrub with two or three tiny white flowers |
| `bush-berry.png` | 256×256 | a small round bush with little red berries |
| `grass-tuft.png` | 256×256 | a tuft of tall soft grass blades with one small daisy |
| `fence.png` | 512×384 | a short wooden garden picket fence section, two posts and rounded pickets, warm orange-brown wood |

## 3. Optional (nice to have)

| File | Size | Prompt |
|---|---|---|
| `cloud.png` | 512×256 | a single fluffy white cartoon cloud, soft blue shading underneath, transparent background |
| `flower-patch.png` | 256×256 | a tiny cluster of three small garden flowers (pink, yellow, purple) on a little patch of grass, transparent background |

## What I'll do in code (no art needed)

- **Sparkles, glows, rings and star bursts** (the effects when blooms pop): I'll draw these in code.
- **Small star icon** (Quests): the game already draws its own star, so I'll use that.

## When the art is ready

1. Save the files with the names above as **PNG**.
2. Put them in `public/assets/art/map/`.
3. Tell me. I'll swap them in, size them to fit, and remove the old free-pack files.
