import math
from icons3d import GREEN
from pro import body, spec, sparkle, svg, uid, EW
from playwright.sync_api import sync_playwright
OUT = "/home/claude/bloomora/art3"
F = {}
from pro import leaf
LEAF_G = dict(light="#d4ff8e", mid="#5cc84a", dark="#1d7a30", edge="#15602a")

def _old_leaf(x, y, L, W, rot):
    """leaf pointing along rot (deg) from base (x,y)"""
    return (f'<path transform="translate({x} {y}) rotate({rot})" '
            f'd="M0 0 C {L*0.3} {-W} {L*0.75} {-W} {L} 0 C {L*0.75} {W} {L*0.3} {W} 0 0 Z"/>')

# ---------- Strawberry ----------
sb = "M256 148 C 336 136 404 172 402 252 C 400 342 318 432 256 452 C 194 432 112 342 110 252 C 108 172 176 136 256 148 Z"
seeds = ""
r = 0
for y in range(196, 440, 36):
    hw = 146 * math.sqrt(max(0, 1 - ((y - 250) / 212) ** 2)) - 26
    off = 18 if r % 2 else 0
    x = 256 - 200 + off
    while x <= 256 + 200:
        if abs(x - 256) < hw:
            seeds += (f'<ellipse cx="{x}" cy="{y}" rx="7" ry="10" fill="#7a0c0c" opacity="0.35"/>'
                      f'<ellipse cx="{x-1}" cy="{y-2}" rx="5.5" ry="8" fill="#ffe08a"/>')
        x += 36
    r += 1
calyx = "".join(leaf(256, 160, 92, 26, a) for a in (-170, -130, -50, -10, 90))
F["strawberry"] = svg(
    body(f'<path d="{sb}"/>', "#ffb4aa", "#f2352c", "#9a0f0f", "#760b0b", box=(110, 136, 402, 452))
    + seeds
    + body(calyx, **LEAF_G, box=(160, 100, 352, 260), edgew=8, bounce_op=0.3)
    + body('<path d="M256 150 C 256 120 262 100 276 80" fill="none"/>', "#b8f07a", "#4fae3c", "#1d6a2a", "#15502a", box=(250, 80, 280, 150), sw=18, edgew=7)
    + spec(186, 228, 40, 18)
)

# ---------- Lemon ----------
a = math.radians(-20)
ex, ey = math.cos(a), math.sin(a)
lem = (f'<ellipse cx="256" cy="282" rx="152" ry="118" transform="rotate(-20 256 282)"/>'
       f'<ellipse cx="{256+160*ex:.0f}" cy="{282+160*ey:.0f}" rx="26" ry="22" transform="rotate(-20 {256+160*ex:.0f} {282+160*ey:.0f})"/>'
       f'<ellipse cx="{256-160*ex:.0f}" cy="{282-160*ey:.0f}" rx="26" ry="22" transform="rotate(-20 {256-160*ex:.0f} {282-160*ey:.0f})"/>')
import random
random.seed(4)
pores = ""
for _ in range(70):
    t, u = random.uniform(0, 2*math.pi), math.sqrt(random.random())
    px, py = 130*u*math.cos(t), 96*u*math.sin(t)
    x, y = 256 + px*ex - py*ey, 282 + px*ey + py*ex
    pores += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3.2" fill="#b07c06" opacity="0.22"/>'
F["lemon"] = svg(
    '<g transform="translate(256 270) scale(1.16) translate(-256 -282)">' +
    body(lem, "#fffde0", "#ffe13a", "#d29606", "#a57405", box=(84, 150, 428, 414))
    + pores
    + body('<path d="M392 214 C 398 190 412 172 432 160" fill="none"/>', "#c6f08a", "#5aa83a", "#2a6a1a", "#1d5012", box=(392, 160, 432, 214), sw=16, edgew=7)
    + body(leaf(392, 196, 120, 34, -150), **LEAF_G, box=(286, 120, 392, 200), edgew=8)
    + '<path d="M388 196 C 350 176 318 166 290 164" fill="none" stroke="#1d7a30" stroke-width="5" opacity="0.6" stroke-linecap="round"/>'
    + spec(186, 226, 50, 20, -25) + '</g>'
)

# ---------- Blueberry ----------
def crown(x, y, s):
    pts = []
    for i in range(10):
        rr = s if i % 2 == 0 else s * 0.45
        ang = math.radians(-90 + i * 36)
        pts.append(f"{x+rr*math.cos(ang):.1f},{y+rr*math.sin(ang):.1f}")
    return (f'<polygon points="{" ".join(pts)}" fill="#141c55" opacity="0.75" stroke="#141c55" stroke-width="5" stroke-linejoin="round"/>'
            f'<circle cx="{x}" cy="{y}" r="{s*0.35:.0f}" fill="#5a6ed0" opacity="0.8"/>')
BB = dict(light="#d6e0ff", mid="#4d66cc", dark="#1b246c", edge="#131a52", bounce="#a9b6ff", bounce_op=0.45)
berries = [(196, 262, 94), (322, 276, 90), (254, 368, 102)]
F["blueberry"] = svg(
    body(leaf(330, 196, 110, 30, -60) + leaf(330, 196, 100, 28, -10), **LEAF_G, box=(330, 90, 440, 220), edgew=8)
    + "".join(body(f'<circle cx="{x}" cy="{y}" r="{rr}"/>', **BB, box=(x-rr, y-rr, x+rr, y+rr))
              + crown(x + rr*0.12, y - rr*0.42, rr*0.24) + spec(x - rr*0.42, y - rr*0.12, rr*0.26, rr*0.12, -50, dot=False)
              for x, y, rr in berries)
)

# ---------- Kiwi (half) ----------
kseeds = ""
for i in range(28):
    ang = math.radians(i * 360 / 28)
    for rad, sz in ((70, 1.0), (96, 0.8)):
        if rad == 96 and i % 2: continue
        x, y = 248 + rad*math.cos(ang), 262 + rad*math.sin(ang)
        kseeds += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{5*sz:.1f}" ry="{11*sz:.1f}" transform="rotate({i*360/28+90:.0f} {x:.1f} {y:.1f})" fill="#1e1a10"/>'
rays = "".join(f'<line x1="{248+52*math.cos(math.radians(i*15)):.0f}" y1="{262+52*math.sin(math.radians(i*15)):.0f}" x2="{248+132*math.cos(math.radians(i*15)):.0f}" y2="{262+132*math.sin(math.radians(i*15)):.0f}"/>' for i in range(24))
F["kiwi"] = svg(
    body('<circle cx="266" cy="284" r="176"/>', "#d9a86a", "#9a6830", "#5a3812", "#43290c", box=(90, 108, 442, 460))
    + body('<circle cx="248" cy="262" r="162"/>', "#ecd2a0", "#b8854a", "#7a5226", "#5c3c18", box=(86, 100, 410, 424), edgew=6, bounce_op=0.2)
    + body('<circle cx="248" cy="262" r="146"/>', "#f0ffb8", "#9adb4e", "#4e9a1e", "#3d7c16", box=(102, 116, 394, 408), edgew=4, bounce_op=0.3)
    + f'<g stroke="#e8ffc0" stroke-width="3" opacity="0.5">{rays}</g>'
    + body('<ellipse cx="248" cy="262" rx="46" ry="40"/>', "#fffff0", "#f4f6d0", "#cfd6a0", "#bfc890", box=(202, 222, 294, 302), edgew=3, bounce_op=0.2)
    + kseeds
    + spec(176, 176, 44, 18)
)

# ---------- Orange slice ----------
R1, R2, R3 = 196, 178, 162
cx, cy = 256, 330
def arc(r):
    return f'M{cx-r} {cy} A {r} {r} 0 0 1 {cx+r} {cy} Z'
segs = ""
n = 5
for i in range(n):
    a0, a1 = math.radians(180 + i*36 + 3.5), math.radians(180 + (i+1)*36 - 3.5)
    r0, r1 = 20, 150
    p = (f'M{cx+r0*math.cos(a0):.1f} {cy+r0*math.sin(a0):.1f} '
         f'L{cx+r1*math.cos(a0):.1f} {cy+r1*math.sin(a0):.1f} '
         f'A {r1} {r1} 0 0 1 {cx+r1*math.cos(a1):.1f} {cy+r1*math.sin(a1):.1f} '
         f'L{cx+r0*math.cos(a1):.1f} {cy+r0*math.sin(a1):.1f} Z')
    segs += f'<path d="{p}"/>'
juice = ""
for i in range(n):
    am = math.radians(180 + i*36 + 18)
    for t in (60, 95, 125):
        x, y = cx + t*math.cos(am), cy + t*math.sin(am)
        juice += f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="9" ry="4" transform="rotate({180+i*36+18} {x:.0f} {y:.0f})" fill="#fff" opacity="0.6"/>'
F["orange"] = svg(
    '<g transform="translate(256 300) scale(1.22) translate(-256 -270) rotate(-16 256 330)">'
    + body(f'<path d="{arc(R1)}"/>', "#ffd08a", "#ff8a1a", "#c04c06", "#963c05", box=(cx-R1, cy-R1, cx+R1, cy))
    + f'<path d="{arc(R2)}" fill="#fff6e0"/>'
    + body(segs, "#ffe2a0", "#ffa020", "#e0660a", "#d86a1a", box=(cx-150, cy-150, cx+150, cy), edgew=3, bounce_op=0.25)
    + juice
    + f'<rect x="{cx-R1-6}" y="{cy-4}" width="{2*R1+12}" height="14" rx="7" fill="#fff6e0" stroke="#963c05" stroke-width="7"/>'
    + spec(cx-120, cy-130, 34, 13, -45, dot=False)
    + '</g>'
)

# ---------- Grape ----------
GR = dict(light="#ecc8ff", mid="#8c3ccc", dark="#3a126a", edge="#2c0d52", bounce="#c79cf0", bounce_op=0.45)
rows = [(4, 196), (4, 250), (3, 304), (2, 356), (1, 404)]
grapes = []
for ri, (cnt, y) in enumerate(rows):
    sh = 14 if ri % 2 else -14
    for k in range(cnt):
        x = 256 + (k - (cnt-1)/2) * 62 + (sh if cnt > 1 else 0)
        grapes.append((x, y))
gsvg = "".join(body(f'<circle cx="{x:.0f}" cy="{y}" r="44"/>', **GR, box=(x-44, y-44, x+44, y+44), edgew=8)
               + spec(x-16, y-16, 12, 6, -45, dot=False) for x, y in grapes)
F["grape"] = svg(
    '<g transform="translate(256 262) scale(1.1) translate(-256 -250)">' +
    body(leaf(250, 150, 120, 36, -160) + leaf(262, 150, 110, 34, -25), **LEAF_G, box=(130, 90, 372, 180), edgew=8)
    + body('<path d="M262 170 C 262 130 270 104 286 86" fill="none"/>', "#d0b080", "#8a6430", "#4e3410", "#3a260c", box=(258, 86, 290, 170), sw=18, edgew=7)
    + '<path d="M286 96 C 320 80 330 112 312 118 C 300 122 296 108 306 104" fill="none" stroke="#3d8a2a" stroke-width="6" stroke-linecap="round"/>'
    + gsvg + '</g>'
)

ORDER = ["strawberry", "lemon", "blueberry", "kiwi", "orange", "grape"]
if __name__ == "__main__":
    with sync_playwright() as p:
        br = p.chromium.launch()
        pg = br.new_page(viewport={"width": 512, "height": 512})
        for name in ORDER:
            pg.set_content(f'<html><body style="margin:0;background:transparent">{F[name]}</body></html>')
            pg.screenshot(path=f"{OUT}/{name}.png", omit_background=True, clip={"x": 0, "y": 0, "width": 512, "height": 512})
        br.close()
    print("done")
