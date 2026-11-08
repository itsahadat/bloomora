import math
from pro import body, spec, svg, leaf, glow
LEAF = dict(light="#e2ffa8", mid="#5cc84a", dark="#1d7a30", edge="#15602a")
STEM = dict(light="#e4ffb0", mid="#8fd85a", dark="#3f8f2a", edge="#2c6e1e")

def P(cx, cy, r, a):
    t = math.radians(a)
    return f"{cx + r*math.cos(t):.1f} {cy + r*math.sin(t):.1f}"

def petal(cx, cy, a, rin, rout, w):
    a0, a1 = a - w/2, a + w/2
    return (f'<path d="M{P(cx,cy,rin,a0)} C {P(cx,cy,rout*0.78,a0-14)} {P(cx,cy,rout*1.06,a0+w*0.12)} {P(cx,cy,rout,a)} '
            f'C {P(cx,cy,rout*1.06,a1-w*0.12)} {P(cx,cy,rout*0.78,a1+14)} {P(cx,cy,rin,a1)} Z"/>')

def lip(cx, cy, a, rout, w, col, sw):
    return (f'<path d="M{P(cx,cy,rout*0.9,a-w*0.22)} Q {P(cx,cy,rout*0.99,a)} {P(cx,cy,rout*0.9,a+w*0.22)}" '
            f'fill="none" stroke="{col}" stroke-width="{sw}" stroke-linecap="round" opacity="0.55"/>')

def rose_bloom(cx, cy, s=1.0, pal=None):
    pal = pal or [("#ffc8e0", "#ff5a9a", "#b0165a", "#8a1046"),
                  ("#ffd0e4", "#ff649f", "#b8185a", "#86103f"),
                  ("#ffe0ee", "#ff7aae", "#c92266", "#8f1244"),
                  ("#fff0f6", "#ff8fbc", "#d42e72", "#8f1244")]
    out = ""
    rings = [(6, 36*s, 158*s, 72, -90), (5, 30*s, 122*s, 84, -54), (5, 22*s, 86*s, 92, -20), (4, 14*s, 54*s, 110, 10)]
    for ri, (n, rin, rout, w, off) in enumerate(rings):
        l, m, d, e = pal[ri]
        for k in range(n):
            a = off + k * 360 / n
            sh = petal(cx, cy, a, rin, rout, w)
            bx = (cx - rout*1.1, cy - rout*1.1, cx + rout*1.1, cy + rout*1.1)
            out += body(sh, l, m, d, e, box=bx, edgew=4 if ri else 6, ao=0.3, bounce_op=0.3, tex="soft", tex_scale=0.8, seed=ri*9+k)
            out += lip(cx, cy, a, rout, w, "#ffffff", 4*s if ri < 2 else 3*s)
    out += glow(cx, cy, 40*s, "#7a0a34", 0.55)
    out += (f'<path d="M{cx-18*s:.1f} {cy+6*s:.1f} C {cx-22*s:.1f} {cy-22*s:.1f} {cx+22*s:.1f} {cy-26*s:.1f} {cx+20*s:.1f} {cy+2*s:.1f} '
            f'C {cx+18*s:.1f} {cy+20*s:.1f} {cx-2*s:.1f} {cy+20*s:.1f} {cx-2*s:.1f} {cy+4*s:.1f}" fill="none" stroke="#ffd6e6" stroke-width="{6*s:.1f}" stroke-linecap="round"/>')
    return out

def rose():
    L = 'M236 360 C 168 330 80 352 48 422 C 118 458 204 438 236 360 Z'
    R = 'M276 360 C 344 330 432 352 464 422 C 394 458 308 438 276 360 Z'
    s = (body(f'<path d="{L}"/><path d="{R}"/>', **LEAF, box=(46, 330, 466, 458), tex="leafy", tex_scale=0.28)
         + '<g fill="none" stroke="#1d7a30" stroke-width="5" stroke-linecap="round" opacity="0.7">'
           '<path d="M228 370 C 178 384 118 404 70 422"/><path d="M284 370 C 334 384 394 404 442 422"/>'
           '<path d="M170 384 L 150 360"/><path d="M120 400 L 100 378"/><path d="M342 384 L 362 360"/><path d="M392 400 L 412 378"/></g>'
         + rose_bloom(256, 228)
         + spec(178, 118, 40, 16, -40))
    return svg(s)

def rose_stem():
    RED = [("#ffa8b8", "#e8204a", "#860b25", "#64081b"), ("#ffb4c2", "#f23c63", "#a8122f", "#64081b"),
           ("#ffc0cc", "#f54d72", "#b81838", "#64081b"), ("#ffd0da", "#ff6a88", "#c42040", "#64081b")]
    stem = 'M226 492 C 220 420 240 330 270 226'
    thorns = "".join(f'<path d="M{x} {y} l{dx} {dy} l{ex} {ey} z"/>' for x, y, dx, dy, ex, ey in
                     [(237, 300, -26, -6, 22, -14), (250, 268, 24, 4, -16, -16), (226, 410, -24, -8, 22, -12), (231, 362, 24, -2, -18, -16), (226, 456, 22, -4, -18, -14)])
    leaves = leaf(242, 318, 130, 40, -20) + leaf(234, 358, 130, 42, -166) + leaf(229, 434, 112, 38, -156)
    veins = ('<g fill="none" stroke="#2c6e1e" stroke-width="5" stroke-linecap="round" opacity="0.55">'
             '<path d="M248 316 L 360 276"/><path d="M228 356 L 110 328"/><path d="M224 432 L 124 388"/></g>')
    sepals = "".join(leaf(268, 238, 64, 15, a) for a in (165, 130, 50, 15))
    s = (body(f'<path d="{stem}" fill="none"/>', **STEM, box=(218, 226, 274, 492), sw=20, edgew=6)
         + body(thorns, **STEM, box=(200, 250, 280, 470), edgew=4, bounce_op=0.2)
         + body(leaves, **LEAF, box=(100, 240, 380, 470), edgew=6, tex="leafy", tex_scale=0.28) + veins
         + body(sepals, **STEM, box=(200, 210, 336, 290), edgew=5)
         + body('<ellipse cx="270" cy="240" rx="40" ry="22"/>', **STEM, box=(230, 218, 310, 262), edgew=5)
         + '<g transform="translate(286 138) scale(0.78) rotate(-12) scale(1 0.9) translate(-256 -228)">' + rose_bloom(256, 228, pal=RED) + '</g>'
         + spec(220, 70, 36, 14, -35))
    return svg(s)

ICONS = {"rose": rose(), "rose-stem": rose_stem()}
