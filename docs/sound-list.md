# Bloomora — Sound Effects & Music List

Every sound the game plays, with when it plays and how it should feel.
All of them now play from files in `public/assets/audio/` except `special.mp3`, which still uses
the sound generated in code. Any file that is missing keeps its generated version.

## Format

- **MP3** (works in every browser and on Android). OGG is fine too if you also give an MP3.
- 44.1 kHz. Mono is fine for short effects; music in stereo.
- Silence at the start or end is fine: the game skips it, so the sound starts **instantly**.
- Loudness is balanced automatically from each file (per-sound tweaks: `weight` in `src/core/Sound.js`).
- Put every file (effects and music) in `public/assets/audio/`, using the names below.

**Overall mood:** cozy, bright, garden and nature. Soft wood, bells, plucks, chimes and leafy swooshes.
No harsh electronic beeps or buzzers, and no heavy explosions, even for the "boom" sounds.

**Pitch:** `pop`, `star` and `drip` are played higher and higher in a row (combo chains, stars 1-2-3,
pot filling up). Make **one file at a middle pitch** and I'll raise the pitch in code.

---

## 1. Most heard — make these first

| File | When it plays | Feel / length |
|---|---|---|
| `pop.mp3` | Blooms are matched and disappear (plays on every match, pitch rises with the combo) | soft bubbly "pop" or a light pluck, 0.1–0.2 s |
| `swap.mp3` | Two blooms swap places; also when a popup opens | quick soft "whoosh" slide, 0.15 s |
| `select.mp3` | Player taps or grabs a bloom | tiny light tap, 0.05–0.1 s |
| `invalid.mp3` | Swap that makes no match (pieces bounce back), not enough coins, ad not available | gentle "bonk" or soft wooden knock, **not** a harsh error buzz, 0.2 s |
| `click.mp3` | Any button press | short soft click or tap, 0.05 s |
| `special.mp3` | A special bloom is created (match 4 or 5, L or T shape) | sparkly rising "ting" or chime, 0.4 s |
| `line.mp3` | A line bloom fires across a whole row or column | fast swoosh plus a chime trail, 0.4 s |
| `blast.mp3` | A burst bloom explodes (small area) | soft round "fwump" with sparkles, 0.4 s |
| `boom.mp3` | A big combo explosion (larger area) | bigger, deeper version of `blast`, still friendly, 0.6 s |
| `rainbow.mp3` | The rainbow seed clears every bloom of one color | magical harp glissando upward, 0.8–1 s |
| `smash.mp3` | Two special blooms swapped into each other (big combo) | heavy magical impact plus a shimmer, 0.7 s |

## 2. Rewards and level flow

| File | When it plays | Feel / length |
|---|---|---|
| `start.mp3` | A level begins | short cheerful "let's go" jingle, 1 s |
| `win.mp3` | Level won (also the Lucky Wheel jackpot and the garden-complete celebration) | happy victory fanfare, 2–3 s |
| `lose.mp3` | Out of moves | soft, kind "aww" descending phrase, not sad or harsh, 1.5 s |
| `star.mp3` | Each star lighting up (score bar and result screen, pitch rises 1→2→3) | bright bell "ding", 0.4 s |
| `coin.mp3` | Coins received or spent | classic coin "cling", 0.2–0.3 s (it plays several times quickly in a row) |
| `sparkle.mp3` | Small rewards: booster received, +3 moves, wheel prize, tutorial steps | soft twinkle shimmer, 0.5 s |
| `tick.mp3` | Lucky Wheel peg ticking as the wheel spins (plays very fast, many times) | very short wooden tick, 0.03 s |

## 3. Garden obstacles and boosters

| File | When it plays | Feel / length |
|---|---|---|
| `crate.mp3` | A wooden planter box gets hit | wood knock, 0.2 s |
| `break.mp3` | A planter box breaks completely | wooden crack and planks falling, 0.4 s |
| `snip.mp3` | A vine is cut | garden shears "snip", 0.15 s |
| `drip.mp3` | Water goes into a thirsty pot (pitch rises as it fills) | single water drop "plip", 0.2 s |
| `bloom.mp3` | A pot blossoms, a weed is pulled, a quest reward is claimed | flower opening: soft rising chime with a leafy rustle, 0.6 s |
| `spread.mp3` | A thorny weed spreads to a new tile | creepy-cute rustle or creak, 0.4 s |
| `dig.mp3` | Trowel booster digs up a tile | shovel into soil "chhk", 0.3 s |
| `breeze.mp3` | Breeze booster shuffles the board; also the Lucky Wheel starting to spin | gentle wind whoosh with leaves, 0.8–1 s |

## 4. Music (loops)

| File | Where | Feel / length |
|---|---|---|
| `music-menu.mp3` | Menu and map | calm, cozy garden tune: music box, light acoustic guitar or ukulele, soft pizzicato. 60–120 s, loops seamlessly |
| `music-level.mp3` | Inside levels | slightly more upbeat and bouncy than the menu tune, but still relaxing (players hear it for a long time). 60–120 s, seamless loop |

If you only make one track, call it `music-menu.mp3` and I'll use it everywhere.

---

## Adding or replacing a file

Drop it into `public/assets/audio/` with the name above. It's picked up on the next reload;
no code change is needed for the names in this list.
