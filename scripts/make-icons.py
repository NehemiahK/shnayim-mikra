"""
Generates the app icons. Three stacked lines stand for the reading itself:
two in white for the two passes of Mikra, one in gold for the Targum.
Run with `python3 scripts/make-icons.py`; output is committed.
"""
from PIL import Image, ImageDraw

TEAL = (13, 110, 99, 255)
WHITE = (255, 255, 255, 255)
GOLD = (212, 163, 57, 255)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def render(size: int, maskable: bool) -> Image.Image:
    # Maskable icons must keep their content inside a safe circle, so the
    # artwork is drawn smaller and the background bleeds to the edges.
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        d.rectangle([0, 0, s, s], fill=TEAL)
        inset = s * 0.22
    else:
        rounded_rect(d, [0, 0, s - 1, s - 1], radius=s * 0.22, fill=TEAL)
        inset = s * 0.24

    usable = s - inset * 2
    bar_h = usable * 0.16
    gap = usable * 0.14
    total = bar_h * 3 + gap * 2
    top = (s - total) / 2

    # Right-aligned, like lines of Hebrew text; the shortest line is the Targum.
    widths = [1.0, 0.82, 0.62]
    colors = [WHITE, WHITE, GOLD]
    for i, (w, color) in enumerate(zip(widths, colors)):
        y = top + i * (bar_h + gap)
        x1 = s - inset
        x0 = x1 - usable * w
        rounded_rect(d, [x0, y, x1, y + bar_h], radius=bar_h / 2, fill=color)

    return img.resize((size, size), Image.LANCZOS)


for size in (192, 512):
    render(size, maskable=False).save(f"public/icon-{size}.png")
    print(f"  icon-{size}.png")
render(512, maskable=True).save("public/icon-maskable-512.png")
print("  icon-maskable-512.png")
render(180, maskable=False).save("public/apple-touch-icon.png")
print("  apple-touch-icon.png")
