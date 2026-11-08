"""Bloomora v2 shading toolkit: semi-realistic cartoon volumes, rendered 2x then downsampled."""
import math, io
from PIL import Image
import numpy as np

CANVAS = [512, 512]
EW = 9
DEFAULT_TEX = [None, 1.0]
_n = [0]
def uid(p):
    _n[0] += 1
    return f"{p}{_n[0]}"

def _stop(off, c):
    if isinstance(c, tuple):
        return f'<stop offset="{off}" stop-color="{c[0]}" stop-opacity="{c[1]}"/>'
    return f'<stop offset="{off}" stop-color="{c}"/>'

def _region():
    W, H = CANVAS
    return f'filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"'

def _mask_attrs():
    W, H = CANVAS
    return f'maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"'

# texture presets: (baseFrequency, octaves, strength-dark, strength-light)
TEX = {
    "fine":  ("0.9", 2, 0.10, 0.06),
    "skin":  ("0.55", 3, 0.12, 0.08),
    "bark":  ("0.012 0.22", 3, 0.30, 0.10),
    "wood":  ("0.006 0.09", 3, 0.28, 0.12),
    "leafy": ("0.06", 4, 0.20, 0.12),
    "grass": ("0.02 0.35", 3, 0.22, 0.12),
    "soft":  ("0.03", 3, 0.10, 0.08),
}

def texture(shapes, kind, attrs, seed=3, scale=1.0):
    W, H = CANVAS
    bf, oc, sd, sl = TEX[kind]
    f1, f2, m = uid("tx"), uid("tl"), uid("tm")
    return (f'<defs><filter id="{f1}" {_region()}><feTurbulence type="fractalNoise" baseFrequency="{bf}" numOctaves="{oc}" seed="{seed}"/>'
            f'<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -1.05"/></filter>'
            f'<filter id="{f2}" {_region()}><feTurbulence type="fractalNoise" baseFrequency="{bf}" numOctaves="{oc}" seed="{seed+7}"/>'
            f'<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.2 0 0 0 -1.1"/></filter>'
            f'<mask id="{m}" {_mask_attrs()}><g fill="#fff" stroke="#fff" {attrs}>{shapes}</g></mask></defs>'
            f'<g mask="url(#{m})"><rect width="{W}" height="{H}" filter="url(#{f1})" opacity="{sd*scale:.2f}"/>'
            f'<rect width="{W}" height="{H}" filter="url(#{f2})" opacity="{sl*scale:.2f}"/></g>')

def body(shapes, light, mid, dark, edge, box, sw=0, edgew=None, bounce_op=0.45, bounce=None,
         outline=True, tex=None, tex_scale=1.0, ao=0.42, seed=3, rim=True):
    """Shaded volume: outline in own darker colour, radial base, soft directional AO,
    soft bounce light, optional surface texture."""
    W, H = CANVAS
    edgew = EW if edgew is None else edgew
    x0, y0, x1, y1 = box
    w, h = max(x1 - x0, 1), max(y1 - y0, 1)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = max(w, h) / 2
    small = min(w, h)
    g, m, aom, bm, af, bf = uid("g"), uid("m"), uid("ao"), uid("bm"), uid("af"), uid("bf")
    bounce = bounce or light
    a = f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"'
    darkc = dark[0] if isinstance(dark, tuple) else dark
    blur_ao = max(2.0, small * 0.09)
    blur_b = max(1.5, small * 0.05)
    out = (f'<defs><radialGradient id="{g}" gradientUnits="userSpaceOnUse" cx="{cx-0.24*w:.1f}" cy="{cy-0.30*h:.1f}" r="{r*1.6:.1f}">'
           f'{_stop(0, light)}{_stop(0.40, mid)}{_stop(1, dark)}</radialGradient>'
           f'<filter id="{af}" {_region()}><feGaussianBlur stdDeviation="{blur_ao:.1f}"/></filter>'
           f'<filter id="{bf}" {_region()}><feGaussianBlur stdDeviation="{blur_b:.1f}"/></filter>'
           f'<mask id="{m}" {_mask_attrs()}><g fill="#fff" stroke="#fff" {a}>{shapes}</g></mask>'
           # AO: shape minus blurred copy shifted up-left  -> soft dark crescent bottom-right + soft edge falloff
           f'<mask id="{aom}" {_mask_attrs()}><g fill="#fff" stroke="#fff" {a}>{shapes}</g>'
           f'<g filter="url(#{af})"><g transform="translate({-0.05*w:.1f} {-0.08*h:.1f})" fill="#000" stroke="#000" {a}>{shapes}</g></g></mask>'
           # bounce: thin soft rim along the bottom edge
           f'<mask id="{bm}" {_mask_attrs()}><g fill="#fff" stroke="#fff" {a}>{shapes}</g>'
           f'<g filter="url(#{bf})"><g transform="translate({-0.03*w:.1f} {-0.05*h:.1f})" fill="#000" stroke="#000" {a}>{shapes}</g></g></mask></defs>')
    if outline:
        out += f'<g fill="{edge}" stroke="{edge}" stroke-width="{sw+2*edgew}" stroke-linecap="round" stroke-linejoin="round">{shapes}</g>'
    out += f'<rect width="{W}" height="{H}" fill="url(#{g})" mask="url(#{m})"/>'
    if tex is None and DEFAULT_TEX[0]:
        tex, tex_scale = DEFAULT_TEX
    if tex:
        out += texture(shapes, tex, a, seed=seed, scale=tex_scale)
    if ao:
        out += f'<rect width="{W}" height="{H}" fill="{darkc}" opacity="{ao}" mask="url(#{aom})"/>'
    if rim:
        out += f'<rect width="{W}" height="{H}" fill="{bounce}" opacity="{bounce_op}" mask="url(#{bm})"/>'
    return out

def spec(cx, cy, rx, ry, rot=-35, op=1.0, dot=True):
    """Soft glossy highlight with a crisp core."""
    g, f = uid("s"), uid("sf")
    rx, ry = rx * 1.25, ry * 1.25
    W, H = CANVAS
    s = (f'<defs><radialGradient id="{g}"><stop offset="0" stop-color="#fff" stop-opacity="{op}"/>'
         f'<stop offset="0.55" stop-color="#fff" stop-opacity="{op*0.75}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
         f'<filter id="{f}" {_region()}><feGaussianBlur stdDeviation="{max(1.0, ry*0.12):.1f}"/></filter></defs>'
         f'<ellipse cx="{cx}" cy="{cy}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({rot} {cx} {cy})" fill="url(#{g})"/>'
         f'<ellipse cx="{cx-rx*0.15:.1f}" cy="{cy-ry*0.1:.1f}" rx="{rx*0.55:.1f}" ry="{ry*0.38:.1f}" transform="rotate({rot} {cx} {cy})" fill="#fff" opacity="{0.9*op:.2f}" filter="url(#{f})"/>')
    if dot:
        ang = math.radians(rot + 90)
        s += f'<circle cx="{cx+ry*1.9*math.cos(ang)+rx*0.5:.1f}" cy="{cy+ry*1.9*math.sin(ang)+ry*0.3:.1f}" r="{max(3.5, ry*0.36):.1f}" fill="#fff" opacity="0.92"/>'
    return s

def glow(cx, cy, r, col, op=0.5):
    g = uid("gl")
    return (f'<defs><radialGradient id="{g}"><stop offset="0" stop-color="{col}" stop-opacity="{op}"/>'
            f'<stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient></defs>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{g})"/>')

def contact_shadow(cx, cy, rx, ry, op=0.28, col="#2a1a10"):
    f = uid("cs")
    return (f'<defs><filter id="{f}" {_region()}><feGaussianBlur stdDeviation="{ry*0.45:.1f}"/></filter></defs>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{col}" opacity="{op}" filter="url(#{f})"/>')

def sparkle(x, y, s, col="#fff", edge="#0b6a85"):
    p = f"M{x} {y-s} Q {x+s*0.18} {y-s*0.18} {x+s} {y} Q {x+s*0.18} {y+s*0.18} {x} {y+s} Q {x-s*0.18} {y+s*0.18} {x-s} {y} Q {x-s*0.18} {y-s*0.18} {x} {y-s} Z"
    return f'<path d="{p}" fill="{col}" stroke="{edge}" stroke-width="4" stroke-linejoin="round"/>'

def svg(inner):
    W, H = CANVAS
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{inner}</svg>'

def leaf(x, y, L, W, rot):
    return (f'<path transform="translate({x} {y}) rotate({rot})" '
            f'd="M0 0 C {L*0.3:.1f} {-W:.1f} {L*0.75:.1f} {-W:.1f} {L} 0 C {L*0.75:.1f} {W:.1f} {L*0.3:.1f} {W:.1f} 0 0 Z"/>')

def circles(lst):
    return "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/>' for x, y, r in lst)

def bbox(lst):
    return (min(x-r for x, y, r in lst), min(y-r for x, y, r in lst), max(x+r for x, y, r in lst), max(y+r for x, y, r in lst))

# ---------------- rendering ----------------
_browser = [None, None]
def _page():
    if _browser[0] is None:
        from playwright.sync_api import sync_playwright
        _browser[1] = sync_playwright().start()
        _browser[0] = _browser[1].chromium.launch()
    return _browser[0]

def render(svgstr, path, w, h, transparent=True, ss=2):
    """Render at ss× then downsample with premultiplied Lanczos for clean, sharp edges."""
    br = _page()
    pg = br.new_page(viewport={"width": w, "height": h}, device_scale_factor=ss)
    pg.set_content(f'<html><body style="margin:0;background:transparent">{svgstr}</body></html>')
    png = pg.screenshot(omit_background=transparent, clip={"x": 0, "y": 0, "width": w, "height": h})
    pg.close()
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    if ss != 1:
        im = im.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
    if transparent:
        a = np.array(im)
        al = a[..., 3]
        al[al < 4] = 0
        a[al == 0, :3] = 0
        im = Image.fromarray(a)
        im.save(path, optimize=True)
    else:
        im.convert("RGB").save(path, optimize=True)
    return im

def close():
    if _browser[0]:
        _browser[0].close(); _browser[1].stop()
        _browser[0] = None
