import math
from pro import body, spec, svg, uid, EW
from fruits3d import leaf, LEAF_G
from playwright.sync_api import sync_playwright
OUT = "/home/claude/bloomora/art3"
F = {}
CLEAR = dict(light=("#fff", 0.3), mid=("#fff", 0), dark=("#0a1a05", 0.5), edge="#000", outline=False, bounce="#fff", bounce_op=0.3)

# Apple
ap = "M256 172 C 300 130 404 140 412 252 C 420 362 340 452 290 442 C 270 438 262 430 256 430 C 250 430 242 438 222 442 C 172 452 92 362 100 252 C 108 140 212 130 256 172 Z"
F["apple"] = svg(
    body('<path d="M256 182 C 254 146 248 120 234 100" fill="none"/>', "#d9a86a", "#8a5a26", "#4a2e10", "#3a240c", box=(230, 100, 260, 182), sw=18, edgew=7)
    + body(f'<path d="{ap}"/>', "#ffb8aa", "#ee2a22", "#8c0c0a", "#6c0908", box=(100, 132, 412, 452))
    + '<ellipse cx="256" cy="184" rx="30" ry="12" fill="#6c0908" opacity="0.3"/>'
    + body(leaf(262, 150, 116, 36, -28), **LEAF_G, box=(262, 90, 370, 160), edgew=8)
    + '<path d="M266 148 C 300 132 330 120 358 104" fill="none" stroke="#1d7a30" stroke-width="5" opacity="0.6" stroke-linecap="round"/>'
    + spec(172, 238, 46, 22, -30)
)

# Watermelon
cx, cy, R = 256, 286, 160
clip = uid("wc")
stripes = ""
for k in (-2.3, -1.15, 0, 1.15, 2.3):
    pts = []
    for i in range(0, 41):
        y = cy - R + i * (2*R/40)
        f = math.sqrt(max(0, 1 - ((y - cy) / R) ** 2))
        wig = 9 * math.sin(i * 1.3) * f
        pts.append(f"{cx + k*58*f + wig:.1f},{y:.1f}")
    stripes += f'<polyline points="{" ".join(pts)}" fill="none" stroke="#165e22" stroke-width="{34}" stroke-linejoin="round"/>'
F["watermelon"] = svg(
    body('<path d="M256 132 C 254 104 268 92 282 100 C 296 110 284 128 270 120" fill="none"/>', "#b8f080", "#3fae3a", "#135a1e", "#0e4818", box=(254, 92, 296, 132), sw=12, edgew=6)
    + body(f'<circle cx="{cx}" cy="{cy}" r="{R}"/>', "#c8f590", "#4cbc40", "#1a6e24", "#0e4818", box=(cx-R, cy-R, cx+R, cy+R))
    + f'<defs><clipPath id="{clip}"><circle cx="{cx}" cy="{cy}" r="{R}"/></clipPath></defs><g clip-path="url(#{clip})" opacity="0.9">{stripes}</g>'
    + body(f'<circle cx="{cx}" cy="{cy}" r="{R}"/>', **CLEAR, box=(cx-R, cy-R, cx+R, cy+R))
    + spec(190, 208, 50, 24)
)

# Pineapple
pcx, pcy, rx, ry = 256, 322, 120, 142
pc = uid("pc")
diag = "".join(f'<line x1="{x}" y1="160" x2="{x+300}" y2="460"/><line x1="{x+300}" y1="160" x2="{x}" y2="460"/>' for x in range(-160, 420, 48))
bumps = ""
for j in range(-4, 5):
    for i in range(-4, 5):
        x, y = pcx + (i - j) * 24 + 0, pcy + (i + j) * 24
        if ((x-pcx)/rx)**2 + ((y-pcy)/ry)**2 < 0.8:
            bumps += f'<ellipse cx="{x-4}" cy="{y-6}" rx="8" ry="5" fill="#fff" opacity="0.45"/>'
crown = "".join(leaf(256, 200, L, W, rot) for rot, L, W in ((-160, 110, 24), (-132, 136, 26), (-108, 150, 26), (-90, 160, 26), (-72, 150, 26), (-48, 136, 26), (-20, 110, 24)))
F["pineapple"] = svg(
    body(crown, light="#c8f590", mid="#3fae3a", dark="#14601f", edge="#0e4818", box=(100, 40, 412, 210), edgew=8, bounce_op=0.3)
    + body(f'<ellipse cx="{pcx}" cy="{pcy}" rx="{rx}" ry="{ry}"/>', "#ffe89a", "#ffa524", "#c05a08", "#94450a", box=(pcx-rx, pcy-ry, pcx+rx, pcy+ry))
    + f'<defs><clipPath id="{pc}"><ellipse cx="{pcx}" cy="{pcy}" rx="{rx}" ry="{ry}"/></clipPath></defs>'
    + f'<g clip-path="url(#{pc})"><g stroke="#b85a0c" stroke-width="7" opacity="0.6">{diag}</g>{bumps}</g>'
    + spec(206, 236, 36, 16, -30)
)

# Banana
bn = ("M108 326 C 140 446 350 450 418 300 C 442 246 440 200 428 162 L 404 168 "
      "C 400 236 372 290 330 318 C 272 356 186 356 126 318 Z")
F["banana"] = svg(
    '<g transform="translate(262 286) scale(1.18) translate(-276 -300)">'
    + body(f'<path d="{bn}"/>', "#fffbd8", "#ffd63a", "#c99606", "#9a7206", box=(112, 162, 434, 430))
    + '<path d="M150 352 C 230 400 340 384 396 290" fill="none" stroke="#d6a00a" stroke-width="7" stroke-linecap="round" opacity="0.6"/>'
    + body('<path d="M402 170 L 398 134 L 436 124 L 444 152 L 424 164 Z"/>', "#b8865a", "#7a4e22", "#3e260c", "#2e1c08", box=(398, 124, 444, 170), edgew=7)
    + '<circle cx="118" cy="330" r="15" fill="#4a2e10" stroke="#2e1c08" stroke-width="6"/>'
    + spec(300, 330, 52, 12, -32, dot=False)
    + '</g>'
)

ORDER = ["apple", "watermelon", "pineapple", "banana"]
if __name__ == "__main__":
    with sync_playwright() as p:
        br = p.chromium.launch()
        pg = br.new_page(viewport={"width": 512, "height": 512})
        for name in ORDER:
            pg.set_content(f'<html><body style="margin:0;background:transparent">{F[name]}</body></html>')
            pg.screenshot(path=f"{OUT}/{name}.png", omit_background=True, clip={"x": 0, "y": 0, "width": 512, "height": 512})
        br.close()
    print("done")
