import sys, os
import pro
pro.DEFAULT_TEX[:] = ["fine", 0.7]
import icons3d, fruits3d, fruits3d_b, extra_icons
OUT = "/home/claude/bloomora/v2/out/art"
os.makedirs(OUT, exist_ok=True)
allicons = {}
allicons.update(icons3d.icons); allicons.update(fruits3d.F); allicons.update(fruits3d_b.F); allicons.update(extra_icons.ICONS)
names = sys.argv[1:] or list(allicons)
for n in names:
    pro.render(allicons[n], f"{OUT}/{n}.png", 512, 512)
pro.close()
print(len(names), "rendered")
