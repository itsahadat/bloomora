# Bloomora art v2 — source

Every image is drawn in code (SVG), rendered at 2x in Chromium, then scaled down
to the exact size for clean, sharp edges.

- `pro.py` — shared shading toolkit (outline, gradient, soft shadow, bounce light, texture, 2x render)
- `run_icons.py` — renders the 26 game icons to `out/art/`
- `map2.py` — renders the 12 map images to `out/map/`

Needs Python 3, Pillow, numpy, and Playwright with Chromium.
