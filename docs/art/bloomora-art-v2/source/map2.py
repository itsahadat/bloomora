import math, random, os, sys
import pro
from pro import body, spec, glow, contact_shadow, leaf, uid

OUT = "/home/claude/bloomora/v2/out/map"
os.makedirs(OUT, exist_ok=True)

def svg(inner):
    W, H = pro.CANVAS
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{inner}</svg>'

def scallop(cx, cy, r, n=9, amp=0.08, rot=0, sy=1.0):
    pts = []
    for i in range(0, 360, 3):
        t = math.radians(i)
        rr = r * (1 - amp + amp * abs(math.sin(n * t / 2 + rot)))
        pts.append(f"{cx + rr*math.cos(t):.1f},{cy + rr*math.sin(t)*sy:.1f}")
    return f'<polygon points="{" ".join(pts)}"/>'

def lumpy_box(lst):
    return (min(x-r for x, y, r in lst), min(y-r for x, y, r in lst), max(x+r for x, y, r in lst), max(y+r for x, y, r in lst))

# leaf palettes: back (shadowed) -> front (lit)
LEAF_BACK = dict(light="#9fd86a", mid="#3a9c3c", dark="#145424", edge="#0f4a20")
LEAF_MID = dict(light="#c4f07e", mid="#4cb844", dark="#1a6a2c", edge="#135a24")
LEAF_FRONT = dict(light="#e4ffa2", mid="#64cc4c", dark="#22803a", edge="#17642a")
TRUNK = dict(light="#e2a670", mid="#9a5a28", dark="#4e2a0e", edge="#3e220a")
WOOD = dict(light="#ffd9a0", mid="#d4843c", dark="#7e4016", edge="#5e2e0c")

def crown(clumps, n=9, amp=0.09, tex_scale=0.55, seed0=0):
    """clumps: list of (x, y, r, depth 0=back 1=mid 2=front) drawn back to front."""
    out = ""
    pals = [LEAF_BACK, LEAF_MID, LEAF_FRONT]
    for i, (x, y, r, d) in enumerate(sorted(clumps, key=lambda c: c[3])):
        sh = scallop(x, y, r, n=n, amp=amp, rot=i * 0.7)
        out += body(sh, **pals[d], box=(x-r, y-r, x+r, y+r), edgew=6, tex="leafy", tex_scale=tex_scale, seed=seed0 + i, ao=0.45, bounce_op=0.35)
        # leaf-tip flicks on lit side
        if d >= 1:
            for k in range(3):
                a = math.radians(-150 + k * 32 + (i * 13) % 20)
                lx, ly = x + r * 0.62 * math.cos(a), y + r * 0.62 * math.sin(a)
                out += f'<path d="M{lx:.1f} {ly:.1f} q {r*0.10:.1f} {-r*0.12:.1f} {r*0.22:.1f} {-r*0.02:.1f}" fill="none" stroke="#f2ffd0" stroke-width="{max(2.5, r*0.035):.1f}" stroke-linecap="round" opacity="0.7"/>'
    return out

def bark_lines(paths, col="#4e2a0e"):
    return f'<g fill="none" stroke="{col}" stroke-width="5" stroke-linecap="round" opacity="0.45">' + "".join(f'<path d="{p}"/>' for p in paths) + '</g>'

def blossom(x, y, r, petal, center, edge):
    p = "".join(f'<circle cx="{x+r*0.55*math.cos(math.radians(a-90)):.1f}" cy="{y+r*0.55*math.sin(math.radians(a-90)):.1f}" r="{r*0.5:.1f}"/>' for a in range(0, 360, 72))
    return (f'<g fill="{edge}" stroke="{edge}" stroke-width="5">{p}</g><g fill="{petal}">{p}</g>'
            f'<circle cx="{x}" cy="{y}" r="{r*0.3:.1f}" fill="{center}" stroke="{edge}" stroke-width="2"/>'
            f'<circle cx="{x-r*0.35:.1f}" cy="{y-r*0.4:.1f}" r="{r*0.14:.1f}" fill="#fff" opacity="0.9"/>')

ART = {}
def reg(name, w, h, transparent=True):
    def deco(fn):
        ART[name] = (w, h, fn, transparent); return fn
    return deco

# ---------------- TREES ----------------
@reg("tree-round", 512, 1024)
def tree_round():
    trunk = ('M196 1010 C 214 990 228 960 232 900 C 236 840 232 780 228 720 L 286 720 '
             'C 282 780 278 840 282 900 C 286 960 300 990 318 1010 Z')
    roots = '<path d="M196 1010 C 210 1000 222 990 230 976 L 244 1010 Z"/><path d="M318 1010 C 304 1000 292 990 284 976 L 270 1010 Z"/>'
    branches = '<path d="M252 820 C 220 790 196 760 186 720" fill="none"/><path d="M264 790 C 300 760 320 730 330 700" fill="none"/>'
    cl = [(256, 230, 110, 0), (150, 330, 112, 0), (362, 330, 112, 0), (110, 470, 100, 0), (402, 470, 100, 0),
          (196, 300, 108, 1), (316, 300, 108, 1), (256, 400, 130, 1), (150, 520, 112, 1), (362, 520, 112, 1),
          (256, 600, 120, 1), (190, 430, 96, 2), (320, 440, 100, 2), (230, 560, 96, 2), (330, 600, 92, 2), (176, 640, 86, 2)]
    s = (contact_shadow(256, 1006, 150, 14, 0.30)
         + body(f'<path d="{trunk}"/>' + roots, **TRUNK, box=(196, 720, 318, 1010), tex="bark", edgew=7)
         + bark_lines(["M246 760 C 244 840 250 900 236 980", "M270 800 C 268 860 272 930 280 990", "M258 880 C 256 920 258 950 262 980"])
         + body(branches, **TRUNK, box=(186, 700, 330, 820), sw=26, edgew=6, tex="bark")
         + crown(cl, seed0=10)
         + "".join(blossom(x, y, 18, "#ffc0da", "#ffd23a", "#c43c78") for x, y in
                   [(214, 210), (320, 250), (128, 360), (380, 380), (240, 380), (300, 470), (176, 520), (392, 520), (250, 600), (318, 640), (160, 640), (110, 470)])
         + spec(196, 196, 52, 20, -30))
    return svg(s)

@reg("tree-tall", 512, 1024)
def tree_tall():
    trunk = 'M222 1010 C 236 980 242 920 244 760 L 270 760 C 272 920 278 980 292 1010 Z'
    cl = []
    rows = [(150, 70), (230, 92), (320, 108), (420, 118), (520, 120), (620, 116), (710, 100)]
    for i, (y, r) in enumerate(rows):
        cl.append((256, y, r, 0))
    for i, (y, r) in enumerate(rows[:-1]):
        cl.append((220, y + 45, r * 0.78, 1)); cl.append((292, y + 50, r * 0.78, 1))
    for i, (y, r) in enumerate(rows[1:-1]):
        cl.append((240 + (i % 2) * 28, y + 20, r * 0.6, 2))
    s = (contact_shadow(256, 1006, 90, 12, 0.3)
         + body(f'<path d="{trunk}"/>', **TRUNK, box=(222, 760, 292, 1010), tex="bark", edgew=6)
         + bark_lines(["M252 800 C 250 880 252 940 244 990", "M262 840 C 262 900 266 950 272 996"])
         + crown([(x, y, r, d) for x, y, r, d in cl], n=11, amp=0.1, seed0=40)
         + spec(214, 150, 30, 62, 12, dot=False))
    return svg(s)

@reg("tree-pine", 512, 1024)
def tree_pine():
    def tier(yt, yb, hw, cx=256, teeth=7):
        # rounded tip, needle-scalloped bottom edge
        pts = [f"M{cx-16} {yt+16} Q {cx} {yt-10} {cx+16} {yt+16}", f"L {cx+hw-18} {yb-26}"]
        for k in range(teeth):
            x1 = cx + hw - 18 - (k + 0.5) * (2 * hw - 36) / teeth
            x2 = cx + hw - 18 - (k + 1) * (2 * hw - 36) / teeth
            dip = 16 + 10 * math.sin(k * 1.7)
            pts.append(f"Q {x1:.1f} {yb + dip:.1f} {x2:.1f} {yb - 6:.1f}")
        pts.append(f"L {cx-16} {yt+16} Z")
        return " ".join(pts)
    trunk = 'M222 1010 C 230 980 232 940 230 820 L 282 820 C 280 940 282 980 290 1010 Z'
    PINE_T = [dict(light="#b0e89a", mid="#2f9a56", dark="#0f4e30", edge="#0b4026"),
              dict(light="#bff0a6", mid="#38a85c", dark="#125a36", edge="#0d4a2c"),
              dict(light="#d2f8b4", mid="#44b866", dark="#16663c", edge="#0f5030")]
    s = (contact_shadow(256, 1006, 130, 14, 0.3)
         + body(f'<path d="{trunk}"/>', **TRUNK, box=(222, 820, 290, 1010), tex="bark", edgew=6)
         + bark_lines(["M250 850 C 248 910 250 960 244 996", "M264 870 C 264 930 266 970 272 1000"]))
    tiers = [(520, 840, 236), (380, 690, 200), (240, 540, 160), (110, 380, 116)]
    for i, (yt, yb, hw) in enumerate(tiers):
        d = tier(yt, yb, hw, teeth=8 - i)
        s += body(f'<path d="{d}"/>', **PINE_T[min(i, 2)], box=(256 - hw, yt, 256 + hw, yb + 20), edgew=6, tex="grass", tex_scale=0.5, seed=60 + i, ao=0.5)
        # needle strokes
        s += '<g fill="none" stroke="#0f4e30" stroke-width="4" stroke-linecap="round" opacity="0.4">'
        for k in range(5):
            x = 256 + (k - 2) * hw * 0.32
            s += f'<path d="M{x:.0f} {yb - 18:.0f} L {x + (k - 2) * 6:.0f} {yb - 50:.0f}"/>'
        s += '</g>'
        s += spec(256 - hw * 0.42, yt + (yb - yt) * 0.52, hw * 0.1, (yb - yt) * 0.2, 30, dot=False)
    return svg(s)

@reg("tree-small", 256, 512)
def tree_small():
    trunk = 'M110 506 C 120 490 124 440 124 300 L 136 300 C 136 440 140 490 150 506 Z'
    stake = '<rect x="160" y="330" width="12" height="176" rx="5"/>'
    tie = '<path d="M130 360 L 166 356" fill="none"/>'
    cl = [(128, 140, 58, 0), (84, 196, 50, 0), (172, 196, 50, 0), (128, 250, 56, 1), (100, 170, 46, 1), (156, 172, 46, 1), (118, 214, 42, 2), (150, 236, 38, 2)]
    s = (contact_shadow(130, 504, 60, 7, 0.3)
         + body(stake, **dict(WOOD, mid="#c8843e"), box=(160, 330, 172, 506), edgew=4, tex="wood")
         + body(f'<path d="{trunk}"/>', **TRUNK, box=(110, 300, 150, 506), edgew=5, tex="bark")
         + body(tie, "#fff3c8", "#e8c870", "#a07a20", "#7a5a10", box=(130, 352, 166, 362), sw=6, edgew=3)
         + crown(cl, n=8, seed0=80)
         + spec(98, 120, 26, 11, -30))
    return svg(s)

# ---------------- BUSHES ----------------
def flat_clip(y):
    c = uid("fc"); W, H = pro.CANVAS
    return c, f'<defs><clipPath id="{c}"><rect x="0" y="0" width="{W}" height="{y}"/></clipPath></defs>'

@reg("bush-wide", 512, 256)
def bush_wide():
    c, d = flat_clip(248)
    base = '<rect x="36" y="150" width="440" height="110" rx="26"/>'
    cl = [(80, 180, 62, 0), (150, 130, 74, 0), (256, 104, 88, 0), (362, 130, 74, 0), (432, 180, 62, 0),
          (120, 196, 60, 1), (210, 150, 70, 1), (306, 150, 70, 1), (392, 196, 60, 1), (256, 196, 66, 2), (170, 210, 52, 2), (346, 210, 52, 2)]
    s = (d + f'<g clip-path="url(#{c})">'
         + body(base, **LEAF_BACK, box=(36, 150, 476, 260), edgew=6, tex="leafy", tex_scale=0.4)
         + crown(cl, n=8, seed0=100)
         + "".join(blossom(x, y, r, col, ctr, e) for x, y, r, col, ctr, e in
                   [(120, 150, 18, "#ffc0da", "#ffd23a", "#c43c78"), (214, 100, 17, "#fff27a", "#ff9a2e", "#c98a06"),
                    (300, 128, 18, "#ffc0da", "#ffd23a", "#c43c78"), (384, 108, 17, "#fff27a", "#ff9a2e", "#c98a06"),
                    (436, 190, 16, "#ffc0da", "#ffd23a", "#c43c78"), (170, 200, 16, "#fff27a", "#ff9a2e", "#c98a06"),
                    (262, 200, 17, "#ffc0da", "#ffd23a", "#c43c78"), (340, 196, 15, "#fff27a", "#ff9a2e", "#c98a06"),
                    (80, 196, 14, "#fff27a", "#ff9a2e", "#c98a06")])
         + spec(210, 66, 42, 15) + '</g>')
    return svg(s)

def round_bush(seed0, pals=None):
    c, d = flat_clip(248)
    base = '<rect x="22" y="160" width="212" height="100" rx="26"/>'
    cl = [(128, 112, 74, 0), (62, 168, 54, 0), (194, 168, 54, 0), (94, 150, 56, 1), (164, 146, 58, 1), (128, 196, 60, 2), (76, 206, 44, 2), (184, 206, 44, 2)]
    return d, c, (body(base, **LEAF_BACK, box=(22, 160, 234, 260), edgew=5, tex="leafy", tex_scale=0.4) + crown(cl, n=8, seed0=seed0))

@reg("bush-round", 256, 256)
def bush_round():
    d, c, b = round_bush(130)
    s = (d + f'<g clip-path="url(#{c})">' + b
         + blossom(92, 120, 18, "#ffffff", "#ffd23a", "#8aa0b8") + blossom(170, 150, 17, "#ffffff", "#ffd23a", "#8aa0b8")
         + blossom(122, 206, 16, "#ffffff", "#ffd23a", "#8aa0b8")
         + spec(92, 70, 28, 11) + '</g>')
    return svg('<g transform="translate(128 250) scale(0.94) translate(-128 -250)">' + s + '</g>')

def berry(x, y, r):
    g = uid("br")
    return (f'<defs><radialGradient id="{g}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffb8b0"/>'
            f'<stop offset="0.45" stop-color="#e8242c"/><stop offset="1" stop-color="#7a0a10"/></radialGradient></defs>'
            f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#{g})" stroke="#5e080c" stroke-width="2.5"/>'
            f'<circle cx="{x-r*0.35:.1f}" cy="{y-r*0.38:.1f}" r="{r*0.24:.1f}" fill="#fff" opacity="0.92"/>'
            f'<circle cx="{x+r*0.3:.1f}" cy="{y+r*0.45:.1f}" r="{r*0.12:.1f}" fill="#3a0406" opacity="0.6"/>')

@reg("bush-berry", 256, 256)
def bush_berry():
    d, c, b = round_bush(160)
    s = d + f'<g clip-path="url(#{c})">' + b
    for cx, cy in [(92, 112), (166, 120), (128, 172), (62, 186), (196, 190), (128, 226)]:
        s += f'<path d="M{cx} {cy-14} L {cx-8} {cy} M{cx} {cy-14} L {cx+9} {cy+2} M{cx} {cy-14} L {cx} {cy+14}" stroke="#3a6a1a" stroke-width="2.5" fill="none"/>'
        s += berry(cx - 9, cy, 11) + berry(cx + 9, cy + 2, 11) + berry(cx, cy + 15, 11)
    s += spec(92, 70, 28, 11) + '</g>'
    return svg('<g transform="translate(128 250) scale(0.94) translate(-128 -250)">' + s + '</g>')

@reg("grass-tuft", 256, 256)
def grass_tuft():
    def blade(bx, tx, ty, w):
        return (f'<path d="M{bx-w} 250 Q {bx-w*0.4+(tx-bx)*0.25:.0f} {(250+ty)/2:.0f} {tx} {ty} '
                f'Q {bx+w*0.6+(tx-bx)*0.35:.0f} {(250+ty)/2:.0f} {bx+w} 250 Z"/>')
    back = blade(60, 22, 120, 14) + blade(200, 236, 104, 14) + blade(128, 112, 36, 15) + blade(170, 196, 60, 13) + blade(86, 60, 70, 13)
    front = blade(96, 70, 92, 16) + blade(156, 186, 82, 16) + blade(124, 146, 108, 14) + blade(108, 90, 140, 12) + blade(140, 120, 150, 12)
    G1 = dict(light="#b8ec84", mid="#3fa840", dark="#155a24", edge="#0f4a1e")
    G2 = dict(light="#e8ffb0", mid="#68d04e", dark="#25843a", edge="#17642a")
    petals = "".join(f'<ellipse cx="{170+19*math.cos(math.radians(a)):.1f}" cy="{80+19*math.sin(math.radians(a)):.1f}" rx="12" ry="6.5" transform="rotate({a} {170+19*math.cos(math.radians(a)):.1f} {80+19*math.sin(math.radians(a)):.1f})"/>' for a in range(0, 360, 30))
    s = (contact_shadow(128, 250, 96, 6, 0.25)
         + body(back, **G1, box=(22, 36, 236, 250), edgew=4, tex="grass", tex_scale=0.5)
         + body('<path d="M156 250 C 156 190 162 130 170 92" fill="none"/>', **G2, box=(152, 92, 174, 250), sw=7, edgew=3)
         + body(front, **G2, box=(54, 82, 202, 250), edgew=4, tex="grass", tex_scale=0.5, seed=9)
         + '<g fill="none" stroke="#e8ffc0" stroke-width="2.5" stroke-linecap="round" opacity="0.6">'
           '<path d="M88 230 Q 78 160 72 98"/><path d="M160 230 Q 172 160 184 90"/><path d="M122 236 Q 132 180 144 114"/></g>'
         + body(petals, "#ffffff", "#ffffff", "#c8d4e4", "#8a9cb4", box=(140, 50, 200, 110), edgew=3, ao=0.25)
         + body('<circle cx="170" cy="80" r="10"/>', "#fff6b0", "#ffd23a", "#d08a06", "#a06a04", box=(160, 70, 180, 90), edgew=3, tex="fine")
         + '<circle cx="166" cy="76" r="3.5" fill="#fff"/>')
    return svg(s)

@reg("fence", 512, 384)
def fence():
    def picket(x, w=40, top=96, bot=376):
        return f'<path d="M{x} {bot} L {x} {top+w/2} A {w/2} {w/2} 0 0 1 {x+w} {top+w/2} L {x+w} {bot} Z"/>'
    rails = '<rect x="64" y="146" width="384" height="38" rx="9"/><rect x="64" y="268" width="384" height="38" rx="9"/>'
    s = (contact_shadow(256, 376, 240, 8, 0.25)
         + body(rails, **dict(WOOD, light="#f0c080", mid="#b86c2c"), box=(64, 146, 448, 306), edgew=5, tex="wood", seed=5))
    for i, x in enumerate((118, 180, 242, 304, 366)):
        s += body(picket(x), **WOOD, box=(x, 96, x + 40, 376), edgew=5, tex="wood", seed=20 + i)
        s += (f'<g fill="none" stroke="#7e4016" stroke-width="3" stroke-linecap="round" opacity="0.45">'
              f'<path d="M{x+13} 140 C {x+11} 200 {x+15} 260 {x+12} 350"/><path d="M{x+27} 190 C {x+29} 240 {x+26} 290 {x+28} 330"/></g>'
              f'<ellipse cx="{x+24}" cy="{230 + (i*37) % 60}" rx="5" ry="8" fill="#6e3610" opacity="0.4"/>')
        for y in (165, 287):
            s += f'<circle cx="{x+20}" cy="{y}" r="5" fill="#8a96a8" stroke="#4a5262" stroke-width="2"/><circle cx="{x+18.5}" cy="{y-1.5}" r="1.8" fill="#fff"/>'
        s += spec(x + 13, 136, 5, 18, 10, dot=False)
    for x0 in (28, 420):
        post = f'<path d="M{x0} 376 L {x0} 82 Q {x0} 52 {x0+32} 50 Q {x0+64} 52 {x0+64} 82 L {x0+64} 376 Z"/>'
        s += body(post, **dict(WOOD, mid="#c27434"), box=(x0, 50, x0 + 64, 376), edgew=6, tex="wood", seed=40 + x0)
        s += body(f'<rect x="{x0-6}" y="74" width="76" height="20" rx="8"/>', **dict(WOOD, mid="#a85e24"), box=(x0 - 6, 74, x0 + 70, 94), edgew=5)
        s += (f'<g fill="none" stroke="#7e4016" stroke-width="3" opacity="0.45"><path d="M{x0+20} 120 C {x0+18} 200 {x0+22} 280 {x0+19} 360"/>'
              f'<path d="M{x0+42} 150 C {x0+44} 230 {x0+41} 300 {x0+44} 350"/></g>')
        s += spec(x0 + 20, 110, 7, 22, 10, dot=False)
    return svg(s)

@reg("cloud", 512, 256)
def cloud():
    back = [(150, 140, 64), (250, 98, 82), (346, 118, 72), (418, 160, 48), (98, 170, 46)]
    front = [(176, 170, 62), (282, 158, 70), (372, 182, 48), (120, 196, 40)]
    sh_b = "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in back) + '<rect x="70" y="150" width="390" height="78" rx="39"/>'
    sh_f = "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in front)
    s = (body(sh_b, "#ffffff", "#f4faff", "#a8c8ea", "#8fb4dc", box=(40, 16, 472, 230), edgew=5, bounce="#eaf6ff", bounce_op=0.6, tex="soft", tex_scale=0.4, ao=0.3)
         + body(sh_f, "#ffffff", "#ffffff", "#c2daf2", "#a4c4e6", box=(80, 88, 420, 232), edgew=4, bounce="#ffffff", bounce_op=0.5, ao=0.22)
         + spec(214, 62, 44, 14, -12, dot=False) + spec(320, 92, 24, 8, -12, dot=False))
    return svg(s)

@reg("flower-patch", 256, 256)
def flower_patch():
    def blade(bx, tx, ty, w):
        return (f'<path d="M{bx-w} 236 Q {bx-w*0.4+(tx-bx)*0.25:.0f} {(236+ty)/2:.0f} {tx} {ty} '
                f'Q {bx+w*0.6+(tx-bx)*0.35:.0f} {(236+ty)/2:.0f} {bx+w} 236 Z"/>')
    G = dict(light="#e8ffb0", mid="#5fc84a", dark="#22803a", edge="#17642a")
    s = (contact_shadow(128, 240, 104, 9, 0.25)
         + body('<ellipse cx="128" cy="228" rx="106" ry="22"/>', **G, box=(22, 206, 234, 250), edgew=4, tex="grass", tex_scale=0.5)
         + body('<path d="M70 226 C 72 190 76 160 80 132" fill="none"/><path d="M128 226 C 128 180 130 140 132 100" fill="none"/><path d="M186 226 C 184 196 182 166 178 140" fill="none"/>',
                **G, box=(66, 100, 190, 226), sw=7, edgew=3)
         + body(leaf(76, 196, 46, 13, -150) + leaf(130, 176, 48, 13, -30) + leaf(182, 190, 44, 12, -40), **G, box=(30, 150, 226, 210), edgew=3)
         + body(blade(52, 30, 168, 9) + blade(206, 230, 164, 9) + blade(100, 94, 176, 8) + blade(158, 164, 172, 8), **G, box=(30, 164, 230, 236), edgew=3))
    for x, y, r, l, m, d, e in ((80, 128, 32, "#ffd8ea", "#ff6aa6", "#c41d5c", "#9c1749"),
                                (132, 94, 34, "#fffbd0", "#ffd43a", "#e48e08", "#b26a06"),
                                (178, 136, 30, "#efdcff", "#a45cf0", "#5a1ea8", "#46158a")):
        p = "".join(f'<ellipse cx="{x+r*0.52*math.cos(math.radians(a-90)):.1f}" cy="{y+r*0.52*math.sin(math.radians(a-90)):.1f}" rx="{r*0.5:.1f}" ry="{r*0.42:.1f}" transform="rotate({a} {x+r*0.52*math.cos(math.radians(a-90)):.1f} {y+r*0.52*math.sin(math.radians(a-90)):.1f})"/>' for a in range(0, 360, 72))
        s += body(p, l, m, d, e, box=(x-r*1.05, y-r*1.05, x+r*1.05, y+r*1.05), edgew=3, ao=0.35)
        s += "".join(f'<path d="M{x:.1f} {y:.1f} L {x+r*0.7*math.cos(math.radians(a-90)):.1f} {y+r*0.7*math.sin(math.radians(a-90)):.1f}" stroke="{d}" stroke-width="2" opacity="0.4"/>' for a in range(0, 360, 72))
        s += body(f'<circle cx="{x}" cy="{y}" r="{r*0.28:.1f}"/>', "#fff6b0", "#ffc83a", "#c07a06", "#9a6004", box=(x-r*0.3, y-r*0.3, x+r*0.3, y+r*0.3), edgew=2, tex="fine")
        s += f'<circle cx="{x-r*0.42:.1f}" cy="{y-r*0.46:.1f}" r="{r*0.13:.1f}" fill="#fff" opacity="0.9"/>'
    return svg(s)

# ---------------- BACKGROUND ----------------
@reg("garden-bg", 2048, 1024, transparent=False)
def garden_bg():
    W, H = 2048, 1024
    TAU = 2 * math.pi
    def wave(base, terms):
        return lambda x: base + sum(a * math.sin(TAU * k * x / W + p) for a, k, p in terms)
    far = wave(596, [(30, 2, 0.5), (12, 5, 1.3)])
    mid = wave(662, [(36, 3, 2.0), (12, 7, 0.0)])
    front = wave(738, [(24, 2, 4.0), (9, 5, 0.7)])
    def hill_path(fn):
        pts = " ".join(f"L{x} {fn(x):.1f}" for x in range(0, W + 1, 8))
        return f"M0 {fn(0):.1f} {pts} L {W} {H} L 0 {H} Z", f"M0 {fn(0):.1f} {pts}"
    def stitched_tex(shape, bf, oc, seed, op_d, op_l):
        f1, f2, m = uid("bt"), uid("bl"), uid("bm")
        reg_ = f'filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"'
        return (f'<defs><filter id="{f1}" {reg_}><feTurbulence type="fractalNoise" baseFrequency="{bf}" numOctaves="{oc}" seed="{seed}" stitchTiles="stitch"/>'
                f'<feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.25  0 0 0 0 0.05  2.2 0 0 0 -1.05"/></filter>'
                f'<filter id="{f2}" {reg_}><feTurbulence type="fractalNoise" baseFrequency="{bf}" numOctaves="{oc}" seed="{seed+5}" stitchTiles="stitch"/>'
                f'<feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 1  0 0 0 0 0.7  2.2 0 0 0 -1.1"/></filter>'
                f'<mask id="{m}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">{shape}</mask></defs>'
                f'<g mask="url(#{m})"><rect width="{W}" height="{H}" filter="url(#{f1})" opacity="{op_d}"/><rect width="{W}" height="{H}" filter="url(#{f2})" opacity="{op_l}"/></g>')
    def hill(fn, gid, c1, c2, line, rim, seed, tex=True):
        d, top = hill_path(fn)
        out = (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="0.35" stop-color="{c2}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
               f'<path d="{d}" fill="url(#{gid})"/>')
        if tex:
            out += stitched_tex(f'<path d="{d}" fill="#fff"/>', "0.004 0.03", 3, seed, 0.22, 0.16)
        out += (f'<path d="{top}" transform="translate(0 10)" fill="none" stroke="{rim}" stroke-width="10" opacity="0.45"/>'
                f'<path d="{top}" fill="none" stroke="{line}" stroke-width="4" opacity="0.65"/>')
        return out
    s = ('<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fa8ea"/>'
         '<stop offset="0.38" stop-color="#8ccdf4"/><stop offset="0.6" stop-color="#d4f0ff"/></linearGradient>'
         '<linearGradient id="clw" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe4f6"/></linearGradient>'
         '<linearGradient id="clb" gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="640"><stop offset="0" stop-color="#f4faff"/><stop offset="1" stop-color="#cfe6f8"/></linearGradient></defs>'
         f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
    # soft sun glow (repeats each tile, away from the edges)
    s += glow(560, 120, 420, "#fff6d0", 0.55)
    def puff_cloud(x, y, sc, fill, edge, op=1.0, hl=True):
        parts = [(0, 0, 60), (-72, 22, 44), (72, 16, 50), (30, -32, 50), (-32, -26, 40), (110, 30, 32), (-110, 34, 30)]
        c = "".join(f'<circle cx="{x+dx*sc:.1f}" cy="{y+dy*sc:.1f}" r="{r*sc:.1f}"/>' for dx, dy, r in parts)
        c += f'<rect x="{x-140*sc:.1f}" y="{y+10*sc:.1f}" width="{280*sc:.1f}" height="{54*sc:.1f}" rx="{27*sc:.1f}"/>'
        o = f'<g opacity="{op}"><g fill="{edge}" stroke="{edge}" stroke-width="{6*sc:.1f}">{c}</g><g fill="{fill}">{c}</g>'
        if hl:
            o += f'<ellipse cx="{x-26*sc:.1f}" cy="{y-38*sc:.1f}" rx="{34*sc:.1f}" ry="{12*sc:.1f}" fill="#fff" opacity="0.95"/>'
            o += f'<ellipse cx="{x:.1f}" cy="{y+46*sc:.1f}" rx="{100*sc:.1f}" ry="{10*sc:.1f}" fill="#b8d4ee" opacity="0.4"/>'
        return o + '</g>'
    def wrap(x, fn):
        return "".join(fn(x + dx) for dx in (-W, 0, W) if -500 < x + dx < W + 500)
    # cloud bank on horizon (big pale puffs)
    random.seed(3)
    shapes = ""
    for i in range(16):
        x = i * W / 16 + random.uniform(-30, 30)
        sc = random.uniform(1.6, 2.4)
        def bank_shape(X, sc=sc):
            y = 520 - sc * 30
            parts = [(0, 0, 60), (-72, 22, 44), (72, 16, 50), (30, -32, 50), (-32, -26, 40), (110, 30, 32), (-110, 34, 30)]
            c = "".join(f'<circle cx="{X+dx*sc:.1f}" cy="{y+dy*sc:.1f}" r="{r*sc:.1f}"/>' for dx, dy, r in parts)
            return c + f'<rect x="{X-140*sc:.1f}" y="{y+10*sc:.1f}" width="{280*sc:.1f}" height="{120*sc:.1f}"/>'
        shapes += wrap(x, bank_shape)
    s += (f'<g fill="#d0e6f6" stroke="#d0e6f6" stroke-width="8">{shapes}</g><g fill="url(#clb)">{shapes}</g>')
    # sky clouds
    for x, y, sc in [(160, 140, 1.25), (600, 300, 0.75), (930, 110, 1.0), (1300, 250, 1.3), (1680, 130, 0.9), (1920, 340, 0.65), (380, 400, 0.5)]:
        s += wrap(x, lambda X, y=y, sc=sc: puff_cloud(X, y, sc, "url(#clw)", "#b8d2ec"))
    # far pale tree silhouettes (atmospheric)
    random.seed(5)
    band = ""
    def far_tree(X, kind, r, col):
        base = far(X % W) + 16
        if kind == 0:   # poplar
            t = scallop(X, base - r * 1.6, r * 0.7, n=10, amp=0.12, sy=2.3)
        elif kind == 1: # round
            t = scallop(X, base - r * 0.9, r, n=9, amp=0.1) + scallop(X + r * 0.7, base - r * 0.5, r * 0.7, n=8, amp=0.1)
        else:           # pine
            t = f'<path d="M{X} {base - r*3.2:.1f} L {X + r*0.9:.1f} {base:.1f} L {X - r*0.9:.1f} {base:.1f} Z"/>'
        return f'<g fill="{col}">{t}</g>'
    for i in range(46):
        x = i * W / 46 + random.uniform(-12, 12)
        kind = random.choice([0, 1, 1, 2])
        r = random.uniform(30, 50)
        col = random.choice(["#b8e0c8", "#aed8c0", "#c2e6d0"])
        band += wrap(x, lambda X, kind=kind, r=r, col=col: far_tree(X, kind, r, col))
    s += band
    s += hill(far, "h1", "#bdeb8e", "#8fd468", "#78bc58", "#e4ffc0", 11)
    # small mid-distance trees and bushes on the middle hill
    random.seed(9)
    mids = ""
    for i in range(18):
        x = i * W / 18 + random.uniform(-30, 30)
        r = random.uniform(16, 26)
        def mt(X, r=r):
            b = mid(X % W) + 4
            return (f'<rect x="{X-3:.1f}" y="{b - r*0.9:.1f}" width="6" height="{r*0.9:.1f}" fill="#8a6a44"/>'
                    + f'<g fill="#5cae4a" stroke="#4a9a3c" stroke-width="3">{scallop(X, b - r*1.4, r, n=8, amp=0.12)}</g>'
                    + f'<circle cx="{X - r*0.3:.1f}" cy="{b - r*1.7:.1f}" r="{r*0.35:.1f}" fill="#9ad87a" opacity="0.8"/>')
        mids += wrap(x, mt)
    s += mids
    s += hill(mid, "h2", "#aee47a", "#72c650", "#5aae40", "#d8ffb0", 23)
    s += hill(front, "h3", "#9ade66", "#5cb840", "#479a34", "#ccf89a", 37)
    # gentle darkening toward the bottom for depth
    s += ('<defs><linearGradient id="vig" x1="0" y1="0" x2="0" y2="1"><stop offset="0.75" stop-color="#1a5a1a" stop-opacity="0"/>'
          '<stop offset="1" stop-color="#1a5a1a" stop-opacity="0.22"/></linearGradient></defs>'
          f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{s}</svg>'

if __name__ == "__main__":
    names = sys.argv[1:] or list(ART)
    for n in names:
        w, h, fn, transp = ART[n]
        pro.CANVAS[:] = [w, h]
        pro.render(fn(), f"{OUT}/{n}.png", w, h, transparent=transp)
        print(n, "ok")
    pro.close()
