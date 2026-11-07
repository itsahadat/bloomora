import math, os, sys
from playwright.sync_api import sync_playwright

OUT = "/home/claude/bloomora/art3"
os.makedirs(OUT, exist_ok=True)
EW = 11  # edge (outline) width
_n = [0]
def uid(p):
    _n[0] += 1
    return f"{p}{_n[0]}"

def _stop(off, c):
    if isinstance(c, tuple):
        return f'<stop offset="{off}" stop-color="{c[0]}" stop-opacity="{c[1]}"/>'
    return f'<stop offset="{off}" stop-color="{c}"/>'

def body(shapes, light, mid, dark, edge, box, sw=0, bounce=None, edgew=EW, bounce_op=0.5, outline=True):
    """3D shaded volume for any set of shapes (fill shapes, or stroked paths when sw>0)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = max(w, h) / 2
    g, m, b = uid("g"), uid("m"), uid("b")
    bounce = bounce or light
    attrs = f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"'
    out = (f'<defs><radialGradient id="{g}" gradientUnits="userSpaceOnUse" cx="{cx-0.22*w:.0f}" cy="{cy-0.28*h:.0f}" r="{r*1.55:.0f}">'
           f'{_stop(0, light)}{_stop(0.42, mid)}{_stop(1, dark)}</radialGradient>'
           f'<mask id="{m}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><g fill="#fff" stroke="#fff" {attrs}>{shapes}</g></mask>'
           f'<mask id="{b}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><g fill="#fff" stroke="#fff" {attrs}>{shapes}</g>'
           f'<g transform="translate({-0.045*w:.1f} {-0.07*h:.1f})" fill="#000" stroke="#000" {attrs}>{shapes}</g></mask></defs>')
    if outline:
        out += f'<g fill="{edge}" stroke="{edge}" stroke-width="{sw+2*edgew}" stroke-linecap="round" stroke-linejoin="round">{shapes}</g>'
    out += f'<rect width="512" height="512" fill="url(#{g})" mask="url(#{m})"/>'
    out += f'<rect width="512" height="512" fill="{bounce}" opacity="{bounce_op}" mask="url(#{b})"/>'
    return out

def spec(cx, cy, rx, ry, rot=-35, op=1.0, dot=True):
    g = uid("s"); rx, ry = rx*1.3, ry*1.3
    s = (f'<defs><radialGradient id="{g}"><stop offset="0" stop-color="#fff" stop-opacity="{op}"/>'
         f'<stop offset="0.7" stop-color="#fff" stop-opacity="{op*0.9}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
         f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" fill="url(#{g})"/>')
    if dot:
        a = math.radians(rot + 90)
        s += f'<circle cx="{cx+ry*1.9*math.cos(a)+rx*0.55:.0f}" cy="{cy+ry*1.9*math.sin(a)+ry*0.3:.0f}" r="{max(5, ry*0.42):.0f}" fill="#fff" opacity="0.9"/>'
    return s

def sparkle(x, y, s, col="#fff", edge="#0b6a85"):
    p = f"M{x} {y-s} Q {x+s*0.18} {y-s*0.18} {x+s} {y} Q {x+s*0.18} {y+s*0.18} {x} {y+s} Q {x-s*0.18} {y+s*0.18} {x-s} {y} Q {x-s*0.18} {y-s*0.18} {x} {y-s} Z"
    return f'<path d="{p}" fill="{col}" stroke="{edge}" stroke-width="5" stroke-linejoin="round"/>'

def svg(body_):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">{body_}</svg>'

GREEN = dict(light="#c4f784", mid="#55c447", dark="#1d7a30", edge="#15602a")
icons = {}

# ================= BLOOMS =================
# Rose
cx, cy = 256, 222
petals = "".join(f'<circle cx="{cx+94*math.cos(math.radians(a-90)):.1f}" cy="{cy+94*math.sin(math.radians(a-90)):.1f}" r="84"/>' for a in range(0, 360, 60)) + f'<circle cx="{cx}" cy="{cy}" r="132"/>'
inner = "".join(f'<circle cx="{cx+46*math.cos(math.radians(a-54)):.1f}" cy="{cy+46*math.sin(math.radians(a-54)):.1f}" r="62"/>' for a in range(0, 360, 72))
leavesL = 'M238 352 C 170 322 82 344 50 414 C 120 450 206 430 238 352 Z'
leavesR = 'M274 352 C 342 322 430 344 462 414 C 392 450 306 430 274 352 Z'
icons["rose"] = svg(
    body(f'<path d="{leavesL}"/><path d="{leavesR}"/>', **GREEN, box=(46, 322, 466, 450))
    + '<g fill="none" stroke="#1d7a30" stroke-width="6" stroke-linecap="round" opacity="0.75"><path d="M230 362 C 180 376 120 396 72 414"/><path d="M282 362 C 332 376 392 396 440 414"/></g>'
    + body(petals, "#ffd6ea", "#ff6aa6", "#c41d5c", "#9c1749", box=(84, 44, 428, 400))
    + body(inner, "#ffe8f3", "#ff8dbd", "#e24382", "#c9306c", box=(148, 114, 364, 330), edgew=5, bounce_op=0.35)
    + body(f'<circle cx="{cx}" cy="{cy}" r="52"/>', "#fff0f7", "#ff9cc6", "#e5508b", "#c9306c", box=(204, 170, 308, 274), edgew=5, bounce_op=0.35)
    + f'<path d="M{cx-26} {cy+8} C {cx-28} {cy-30} {cx+28} {cy-32} {cx+26} {cy+4} C {cx+24} {cy+28} {cx-6} {cy+28} {cx-4} {cy+6}" fill="none" stroke="#c9306c" stroke-width="8" stroke-linecap="round"/>'
    + spec(176, 112, 50, 22)
)

# Leaf
leaf = "M108 412 C 86 250 214 98 412 94 C 426 286 306 422 108 412 Z"
icons["leaf"] = svg(
    body('<path d="M124 398 L 76 446" fill="none"/>', "#d99a5c", "#9a5a28", "#5e3212", "#4a280e", box=(70, 390, 130, 450), sw=18)
    + body(f'<path d="{leaf}"/>', "#d8ff8a", "#62d14a", "#1b7a30", "#155f26", box=(86, 94, 426, 422))
    + '<g fill="none" stroke="#1d7a30" stroke-width="8" stroke-linecap="round" opacity="0.8">'
      '<path d="M128 394 C 216 300 300 206 400 106"/>'
      '<path d="M188 330 C 178 290 180 258 194 228"/><path d="M188 330 C 228 336 262 332 292 318"/>'
      '<path d="M250 266 C 244 228 250 198 266 172"/><path d="M250 266 C 290 268 322 260 350 246"/>'
      '<path d="M310 202 C 308 176 314 156 326 140"/><path d="M310 202 C 336 202 356 196 374 186"/></g>'
    + spec(246, 160, 56, 20, -40)
)

# Drop
drop = "M256 56 C 256 56 408 232 408 330 A 152 152 0 0 1 104 330 C 104 232 256 56 256 56 Z"
icons["drop"] = svg(
    body(f'<path d="{drop}"/>', "#e4f8ff", "#46b2f6", "#1259c0", "#0e4596", box=(104, 56, 408, 482), bounce="#bfeaff", bounce_op=0.6)
    + spec(192, 260, 32, 70, 22, dot=False)
    + '<circle cx="214" cy="372" r="14" fill="#fff" opacity="0.85"/>'
    + sparkle(352, 120, 22, edge="#0e4596")
)

# Sun / sunflower
rays = "".join(f'<ellipse cx="256" cy="{256-140}" rx="44" ry="60" transform="rotate({a} 256 256)"/>' for a in range(0, 360, 30))
seeds = ""
for i in range(34):
    a = i * 137.5
    rr = 9 * math.sqrt(i) * 1.32
    x, y = 256 + rr * math.cos(math.radians(a)), 256 + rr * math.sin(math.radians(a))
    seeds += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="#8a330a" opacity="0.45"/>'
icons["sun"] = svg(
    body(rays, "#fffbd0", "#ffd43a", "#e48e08", "#b26a06", box=(56, 56, 456, 456), bounce_op=0.22)
    + body('<circle cx="256" cy="256" r="108"/>', "#ffc978", "#f5841c", "#b9470b", "#97390a", box=(148, 148, 364, 364), edgew=9)
    + seeds
    + spec(206, 202, 40, 18) + spec(150, 110, 22, 11, -40, dot=False)
)

# Berry (raspberry)
base = [(256,170),(206,190),(306,190),(170,236),(226,232),(286,232),(342,236),
        (182,290),(236,284),(292,284),(330,290),(214,338),(266,336),(310,334),(256,384),(228,382),(286,380)]
pts = [(256 + (x-256)*1.2, 290 + (y-277)*1.2) for x, y in base]
drupes = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="48"/>' for x, y in pts)
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
bbox = (min(xs)-48, min(ys)-48, max(xs)+48, max(ys)+48)
seg = "".join(f'<ellipse cx="{x-14:.0f}" cy="{y-16:.0f}" rx="13" ry="9" transform="rotate(-35 {x-14:.0f} {y-16:.0f})" fill="#fff" opacity="0.7"/>' for x, y in pts)
bl = ('<path d="M256 120 C 214 66 166 76 142 102 C 188 128 226 134 256 120 Z"/>'
      '<path d="M256 120 C 298 66 346 76 370 102 C 324 128 286 134 256 120 Z"/>'
      '<path d="M256 120 C 238 78 250 44 274 28 C 286 66 274 100 256 120 Z"/>')
icons["berry"] = svg(
    body(drupes, "#ffb0f0", "#d42ab0", "#6e0c60", "#560a4b", box=bbox)
    + seg
    + body(bl, **GREEN, box=(142, 28, 370, 134), edgew=9)
    + spec(196, 186, 34, 15)
)

# Crystal
poly = "150,190 206,118 306,118 362,190 256,414"
icons["crystal"] = svg(
    '<g transform="translate(256 262) scale(1.26) translate(-256 -266)">'
    + body(f'<polygon points="{poly}"/>', "#effeff", "#40d6e8", "#0a86aa", "#08627e", box=(150, 118, 362, 414), edgew=9)
    + '<polygon points="206,118 256,190 306,118" fill="#fff" opacity="0.5"/>'
    + '<polygon points="150,190 206,118 256,190" fill="#fff" opacity="0.28"/>'
    + '<polygon points="306,118 362,190 256,190" fill="#05607a" opacity="0.12"/>'
    + '<polygon points="150,190 256,190 256,414" fill="#fff" opacity="0.14"/>'
    + '<polygon points="256,190 362,190 256,414" fill="#05607a" opacity="0.22"/>'
    + '<g fill="none" stroke="#08627e" stroke-width="5" stroke-linejoin="round" opacity="0.6"><polyline points="150,190 362,190"/><polyline points="206,118 256,190 306,118"/><line x1="256" y1="190" x2="256" y2="414"/></g>'
    + spec(206, 152, 24, 10, -50, dot=False)
    + '</g>'
    + sparkle(410, 112, 26) + sparkle(104, 360, 16)
)

# ================= SPECIALS =================
def fuse_cap(x, y):
    return (body(f'<rect x="{x-34}" y="{y}" width="68" height="44" rx="12"/>', "#e6ebf2", "#8c96a6", "#454c5a", "#2e333d", box=(x-34, y, x+34, y+44), edgew=8)
            + body(f'<path d="M{x} {y+4} C {x} {y-36} {x+36} {y-46} {x+48} {y-70}" fill="none"/>', "#f6d29a", "#b97a3a", "#6e4317", "#4a2c0e", box=(x, y-70, x+48, y+4), sw=14, edgew=6)
            + f'<g transform="translate({x+52} {y-76})">'
              f'<path d="M0 -36 L9 -11 L36 -14 L14 3 L24 30 L0 14 L-24 30 L-14 3 L-36 -14 L-9 -11 Z" fill="#ffd23a" stroke="#e8651a" stroke-width="6" stroke-linejoin="round"/>'
              f'<circle r="10" fill="#fff"/></g>')

# Rainbow seed (rainbow bomb)
cx, cy, R = 256, 296, 150
cols = ["#ff4d6d", "#ff9a2e", "#ffd93a", "#4fd36b", "#3aa8ff", "#9b5cff"]
clip = uid("c")
bands = "".join(f'<rect x="60" y="{cy-R-40+i*58}" width="400" height="60" fill="{c}"/>' for i, c in enumerate(cols + cols[:1]))
icons["rainbow-seed"] = svg(
    f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="#4a2a6a" stroke="#4a2a6a" stroke-width="{2*EW}"/>'
    + f'<defs><clipPath id="{clip}"><circle cx="{cx}" cy="{cy}" r="{R}"/></clipPath></defs>'
    + f'<g clip-path="url(#{clip})"><g transform="rotate(-22 {cx} {cy})">{bands}</g></g>'
    + body(f'<circle cx="{cx}" cy="{cy}" r="{R}"/>', ("#fff", 0.35), ("#fff", 0), ("#1a0a30", 0.55), "#000", box=(cx-R, cy-R, cx+R, cy+R), outline=False, bounce="#fff", bounce_op=0.35)
    + spec(196, 216, 50, 24)
    + fuse_cap(256, 118)
)

# Line pieces (capsule rocket)
def capsule():
    endL = 'M200 184 C 120 184 66 210 62 256 C 66 302 120 328 200 328 Z'
    endR = 'M312 184 C 392 184 446 210 450 256 C 446 302 392 328 312 328 Z'
    return (body(f'<path d="{endL}"/><path d="{endR}"/>', "#ffb4a4", "#f03a2c", "#9c120c", "#7a0e09", box=(62, 184, 450, 328))
            + body('<rect x="180" y="184" width="152" height="144" rx="28"/>', "#d4ff94", "#4cc447", "#1a7330", "#135a24", box=(180, 184, 332, 328))
            + '<g stroke="#135a24" stroke-width="7" stroke-linecap="round" opacity="0.55"><line x1="216" y1="196" x2="216" y2="316"/><line x1="296" y1="196" x2="296" y2="316"/></g>'
            + '<rect x="196" y="200" width="120" height="22" rx="11" fill="#fff" opacity="0.55"/>'
            + spec(126, 222, 40, 14, -12, dot=False) + spec(386, 222, 40, 14, 12, dot=False))
icons["line-h"] = svg(capsule())
icons["line-v"] = svg(f'<g transform="rotate(90 256 256)">{capsule()}</g>')

# Bomb (area burst)
icons["bomb"] = svg(
    body('<circle cx="256" cy="296" r="148"/>', "#ffc2b4", "#f2402c", "#9a130c", "#760e09", box=(108, 148, 404, 444))
    + spec(196, 216, 50, 24)
    + body('<path d="M226 128 C 196 96 156 100 140 122 C 172 140 204 142 226 128 Z"/>', **GREEN, box=(140, 96, 226, 142), edgew=7)
    + fuse_cap(256, 118)
)

# ================= BOOSTERS =================
blade = "M256 66 C 334 108 344 222 302 284 L 210 284 C 168 222 178 108 256 66 Z"
icons["trowel"] = svg(
    '<g transform="rotate(35 256 270)">'
    + body('<rect x="228" y="312" width="56" height="152" rx="28"/>', "#f6b874", "#c06a2a", "#6e3610", "#55290b", box=(228, 312, 284, 464))
    + '<g stroke="#6e3610" stroke-width="6" stroke-linecap="round" opacity="0.5"><line x1="246" y1="344" x2="246" y2="436"/><line x1="266" y1="354" x2="266" y2="424"/></g>'
    + body('<rect x="232" y="278" width="48" height="44" rx="10"/>', "#e8edf3", "#98a3b4", "#525b6b", "#3d4450", box=(232, 278, 280, 322), edgew=8)
    + body(f'<path d="{blade}"/>', "#ffffff", "#cfd8e3", "#7a879a", "#4f5a6a", box=(170, 66, 344, 284))
    + '<path d="M256 96 L 256 264" stroke="#8b97a8" stroke-width="8" stroke-linecap="round"/>'
    + spec(222, 140, 18, 44, 8, dot=False)
    + '</g>'
)

s1 = "M70 196 L 300 196 C 362 196 382 112 330 92 C 288 78 262 114 282 142"
s2 = "M104 282 L 382 282 C 454 282 464 386 402 404 C 360 416 330 386 346 352"
s3 = "M62 364 L 252 364"
WHITE = dict(light="#ffffff", mid="#eef8ff", dark="#9cc6e6", edge="#4f86b0")
MINT = dict(light="#e0fff4", mid="#6fe0b8", dark="#22a07a", edge="#1a7a5c")
icons["breeze"] = svg(
    body(f'<path d="{s1}" fill="none"/>', **WHITE, box=(70, 78, 384, 196), sw=40, edgew=9)
    + body(f'<path d="{s2}" fill="none"/>', **MINT, box=(104, 282, 466, 416), sw=40, edgew=9)
    + body(f'<path d="{s3}" fill="none"/>', **WHITE, box=(62, 344, 252, 384), sw=34, edgew=9)
    + '<g stroke="#fff" stroke-width="9" stroke-linecap="round" opacity="0.8"><line x1="88" y1="186" x2="270" y2="186"/><line x1="124" y1="272" x2="360" y2="272"/><line x1="80" y1="356" x2="230" y2="356"/></g>'
)

arrows = ('<path d="M122 172 C 172 84 328 74 386 148" fill="none"/>'
          '<path d="M390 340 C 340 428 184 438 126 364" fill="none"/>')
heads = '<polygon points="410,100 420,188 340,168"/><polygon points="102,412 92,324 172,344"/>'
wings = '<ellipse cx="204" cy="176" rx="50" ry="62" transform="rotate(-25 204 176)"/><ellipse cx="308" cy="176" rx="50" ry="62" transform="rotate(25 308 176)"/>'
bc = uid("bc")
icons["bee-swap"] = svg(
    body(arrows, "#ffffff", "#d8efff", "#7fb6e6", "#2a6fb8", box=(92, 74, 420, 438), sw=30, edgew=9)
    + body(heads, "#ffffff", "#d8efff", "#7fb6e6", "#2a6fb8", box=(92, 100, 420, 412), edgew=9)
    + body(wings, "#ffffff", "#e6f6ff", "#a9d2f0", "#5b8fb5", box=(150, 110, 362, 240), edgew=8, bounce_op=0.3)
    + body('<circle cx="256" cy="272" r="104"/>', "#fff8b8", "#ffc21c", "#c27a00", "#9c5f00", box=(152, 168, 360, 376))
    + f'<defs><clipPath id="{bc}"><circle cx="256" cy="272" r="104"/></clipPath></defs>'
    + f'<g clip-path="url(#{bc})" fill="#4a2a10" opacity="0.92"><rect x="140" y="296" width="240" height="26"/><rect x="140" y="342" width="240" height="26"/></g>'
    + '<circle cx="222" cy="250" r="15" fill="#3b2414"/><circle cx="290" cy="250" r="15" fill="#3b2414"/>'
    + '<circle cx="227" cy="244" r="5" fill="#fff"/><circle cx="295" cy="244" r="5" fill="#fff"/>'
    + '<ellipse cx="200" cy="278" rx="14" ry="8" fill="#ff8fb0" opacity="0.8"/><ellipse cx="312" cy="278" rx="14" ry="8" fill="#ff8fb0" opacity="0.8"/>'
    + '<path d="M238 274 Q 256 292 274 274" fill="none" stroke="#3b2414" stroke-width="7" stroke-linecap="round"/>'
    + '<g stroke="#3b2414" stroke-width="8" stroke-linecap="round" fill="none"><path d="M236 174 Q 226 142 206 134"/><path d="M276 174 Q 286 142 306 134"/></g>'
    + '<circle cx="204" cy="132" r="11" fill="#3b2414"/><circle cx="308" cy="132" r="11" fill="#3b2414"/>'
    + spec(214, 212, 28, 12)
)

def star_pts(n, ro, ri, cx=256, cy=256, rot=-90):
    p = []
    for i in range(n * 2):
        r = ro if i % 2 == 0 else ri
        a = math.radians(rot + i * 180 / n)
        p.append(f"{cx + r*math.cos(a):.1f},{cy + r*math.sin(a):.1f}")
    return " ".join(p)
icons["burst-start"] = svg(
    body(f'<polygon points="{star_pts(14, 202, 146)}"/>', "#fff1a0", "#ff9a24", "#c8460c", "#a33a0a", box=(54, 54, 458, 458))
    + body(f'<polygon points="{star_pts(5, 112, 50)}"/>', "#fffbe6", "#ffe04a", "#f09a12", "#d0700c", box=(144, 144, 368, 368), edgew=8)
    + spec(170, 150, 34, 15)
)

icons["plus-moves"] = svg(
    body('<circle cx="256" cy="256" r="192"/>', "#bfe4ff", "#3d8ef0", "#123f9c", "#0d2f78", box=(64, 64, 448, 448))
    + '<circle cx="256" cy="256" r="160" fill="none" stroke="#cfe8ff" stroke-width="8" opacity="0.5"/>'
    + '<text x="262" y="330" text-anchor="middle" font-family="Inter" font-weight="900" font-size="196" fill="#0d2f78" opacity="0.45">+3</text>'
    + '<text x="256" y="320" text-anchor="middle" font-family="Inter" font-weight="900" font-size="196" fill="#fff" stroke="#0d2f78" stroke-width="16" paint-order="stroke" stroke-linejoin="round">+3</text>'
    + spec(166, 136, 52, 22)
)

ORDER = ["rose", "leaf", "drop", "sun", "berry", "crystal",
         "rainbow-seed", "line-h", "line-v", "bomb",
         "trowel", "breeze", "bee-swap", "burst-start", "plus-moves"]

if __name__ == "__main__":
    with sync_playwright() as p:
        br = p.chromium.launch()
        pg = br.new_page(viewport={"width": 512, "height": 512})
        for name in ORDER:
            pg.set_content(f'<html><body style="margin:0;background:transparent">{icons[name]}</body></html>')
            pg.screenshot(path=f"{OUT}/{name}.png", omit_background=True, clip={"x": 0, "y": 0, "width": 512, "height": 512})
        br.close()
    print("done")
