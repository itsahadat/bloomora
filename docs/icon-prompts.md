# Bloomora — Icon & Art Prompts

Prompts for generating every icon and image in the game with an image tool
(Midjourney, DALL·E, Ideogram, etc.).

## Base style — add to the end of every icon prompt

```
casual mobile match-3 game icon, glossy semi-realistic 3D cartoon style, rounded chunky shapes, soft studio lighting, smooth gradient shading, bright specular highlight on top-left, subtle soft drop shadow, no outline, vibrant warm saturated colors, centered, single object, no text, transparent background, 512x512
```

**Look we're going for:** premium, juicy and glossy, like candy or fresh fruit under soft light. No thick black outlines and no flat colors.
Pieces sit on cream tiles on a dark-teal board, in front of a blurred forest background.

**Tips**

- Make every icon in the **same tool and the same chat** so the style stays consistent.
- If the tool can't do a transparent background, ask for "plain white background" and remove it afterwards (e.g. remove.bg).
- Save as **PNG, 512×512**, using the file names below.
- Put finished files in `public/assets/art/`.

**Priority:** if you're short on time, make **1. Blooms** and **4. Boosters** first, because they're on screen the most.

---

## 1. Blooms: the 6 match pieces (most important)

All six should be **similar in size and shape** and easy to tell apart by color.

| File | Prompt |
|---|---|
| `rose.png` | a round pink rose flower bloom, layered petals, cheerful |
| `leaf.png` | a fresh bright green leaf with a curled tip and visible vein |
| `drop.png` | a shiny sky-blue water droplet, plump and round |
| `sun.png` | a golden yellow sunflower-sun with rounded petal rays and a warm orange center |
| `berry.png` | a juicy purple-magenta raspberry berry with a small green leaf on top |
| `crystal.png` | a cyan aqua gem crystal, faceted, sparkling |
| `carrot.png` | a fresh orange carrot with a leafy green top, slightly tilted |
| `strawberry.png` | a juicy red strawberry with yellow seeds and a green leafy cap |
| `apple.png` | a shiny lime-green apple with a brown stem and one leaf |
| `mushroom.png` | a cute brown-capped mushroom with a cream stem and a few light spots |

## 2. Special blooms

| File | Prompt |
|---|---|
| `rainbow-seed.png` | a magical rainbow orb seed, swirl of pink yellow green blue purple, glowing white center |
| `line-arrows.png` | two white chunky arrows pointing left and right, overlay effect, simple |
| `burst-ring.png` | a glowing circular sparkle ring with four small white dots around it |

## 3. Obstacles

| File | Prompt |
|---|---|
| `soil-1.png` | square tile of light brown dry cracked garden soil, top-down view, rounded corners |
| `soil-2.png` | square tile of dark brown very dry cracked soil, more cracks, top-down, rounded corners |
| `grass.png` | square tile of soft light green grass with tiny blades, top-down, rounded corners |
| `crate-1.png` | a small wooden planter box crate, front view, warm orange-brown wood planks |
| `crate-2.png` | the same wooden planter crate with two grey metal bands and rivets, sturdier |
| `vine.png` | green twisting vines with small leaves forming a cage, transparent center, overlay |
| `weed.png` | a mischievous dark green thorny bramble weed ball with white thorns and a small purple bud |
| `seed.png` | a brown acorn-like seed pod with a tiny green sprout on top, cute |
| `pot.png` | a terracotta clay flower pot with dry soil inside, empty, waiting for water, cute |

## 4. Boosters

| File | Prompt |
|---|---|
| `trowel.png` | a garden trowel shovel, wooden handle, shiny silver blade, tilted |
| `breeze.png` | a swirling wind gust symbol with two curved arrows, white and mint green |
| `bee-swap.png` | a cute round bumblebee holding two swap arrows |
| `burst-start.png` | an orange-yellow starburst explosion badge |
| `plus-moves.png` | a blue round badge with a big white "+3" |

> If `plus-moves.png` comes out with wrong text, generate it without text; "+3" can be added in code.

## 5. UI icons

| File | Prompt |
|---|---|
| `coin.png` | a shiny gold coin with a flower stamped in the middle |
| `gift.png` | a pink gift box with a yellow ribbon bow, slightly open with sparkles |
| `heart.png` | a glossy red heart (life) |
| `heart-empty.png` | the same heart, grey and empty |
| `star.png` | a glossy golden star with rounded points |
| `star-grey.png` | the same star in flat grey |
| `lock.png` | a small grey padlock |
| `speaker-on.png` | a white speaker with sound waves |
| `speaker-off.png` | a white speaker with a red X |
| `hand.png` | a white cartoon pointing hand (tutorial) |
| `gear.png` | a settings gear |

## 6. Large art (optional; do not add the base style)

| File | Prompt |
|---|---|
| `logo.png` | game logo "BLOOMORA", bubbly rounded letters each a different flower color, white outline, small flowers and leaves around, transparent background |
| `bg-garden.png` | stylized cartoon forest garden background, soft heavy depth-of-field blur, bokeh light, lush green trees, glimpses of blue sky, warm sunlight, no characters, no objects in focus, 1920x1080 (also make a 1080x1920 portrait version) |
| `map-meadow.png` | top-down cartoon meadow texture, light green grass with small flowers, seamless tileable |

## 7. UI frames & effects (optional; do not add the base style)

These replace the drawn-in-code panels with the wooden/parchment look.

| File | Prompt |
|---|---|
| `panel.png` | empty game UI popup panel, cream parchment center with thin dashed brown inner border, thick rounded warm-brown wooden frame, small pink flowers with leaves on top-right and bottom-left corners, front view, transparent background, 1024x1024 |
| `card.png` | small empty game UI card, cream inner box with rounded corners, light wooden orange-brown frame, front view, transparent background, 512x512 |
| `btn-yellow.png` | empty glossy yellow-orange pill game button, rounded, soft bevel, darker bottom edge, no text, transparent background |
| `btn-blue.png` | empty glossy blue pill game button, rounded, soft bevel, darker bottom edge, no text, transparent background |
| `btn-close.png` | glossy red rounded square button with a white X, game UI, transparent background |
| `btn-pause.png` | glossy green rounded square button with a white pause icon, game UI, transparent background |
| `booster-slot.png` | empty glossy blue rounded square booster slot, game UI, small green circle plus badge in bottom-right corner, transparent background |
| `rays.png` | radial golden light rays bursting from the center, soft glow, game victory effect, transparent background, 1024x1024 |
| `big-star.png` | big glossy jelly golden star with rounded points, orange rim, shiny highlight, transparent background, 1024x1024 |

---

## Checklist

- [ ] 1. Blooms (6)
- [ ] 2. Special blooms (3)
- [ ] 3. Obstacles (9)
- [ ] 4. Boosters (5)
- [ ] 5. UI icons (11)
- [ ] 6. Large art (3, optional)
- [ ] 7. UI frames & effects (9, optional)
