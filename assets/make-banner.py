"""Render the README banner (light and dark) as self-contained SVGs.

Text is converted to outlines with the site's own Geist fonts, so the banner
looks the same everywhere (GitHub renders README images without web fonts).
The X.Y.Z art reuses the glyphs from site/src/hero-art.js.

    pip install fonttools brotli uharfbuzz
    python3 .github/assets/make-banner.py
"""
import io
import sys
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
FONTS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "site/public/fonts"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent

W, H = 1280, 440
PAD = 64

THEMES = {
    "dark": dict(bg="#000000", border="#262626", text="#ededed", muted="#a3a3a3",
                 faint="#737373", dim="#333333", tok="#8fb3e0", signal="#3ecf74"),
    "light": dict(bg="#ffffff", border="#e6e6e6", text="#171717", muted="#636363",
                  faint="#8f8f8f", dim="#dcdcdc", tok="#3e5f8a", signal="#0a7d3e"),
}


class Face:
    """One font at one weight: shaping with HarfBuzz, outlines from fontTools."""

    def __init__(self, file, wght):
        src = TTFont(FONTS / file)
        src.flavor = None
        if "fvar" in src:
            src = instancer.instantiateVariableFont(src, {"wght": wght})
        buf = io.BytesIO()
        src.save(buf)
        data = buf.getvalue()
        self.tt = TTFont(io.BytesIO(data))
        self.upem = self.tt["head"].unitsPerEm
        self.glyphset = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.hbfont = hb.Font(hb.Face(hb.Blob(data)))
        self.cache = {}

    def shape(self, text):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hbfont, buf, {"kern": True, "liga": False})
        return [(self.order[i.codepoint], p.x_advance, p.x_offset, p.y_offset)
                for i, p in zip(buf.glyph_infos, buf.glyph_positions)]

    def path(self, name, size, x, y):
        s = size / self.upem
        pen = SVGPathPen(self.glyphset, lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        self.glyphset[name].draw(TransformPen(pen, (s, 0, 0, -s, x, y)))
        return pen.getCommands()

    def run(self, text, size, x, y, tracking=0.0):
        """Outline a run of text; returns (svg path data, advance in px)."""
        s = size / self.upem
        cmds, pen_x = [], x
        for name, adv, dx, dy in self.shape(text):
            d = self.path(name, size, pen_x + dx * s, y - dy * s)
            if d:
                cmds.append(d)
            pen_x += adv * s + tracking * size
        return " ".join(cmds), pen_x - x

    def width(self, text, size, tracking=0.0):
        return sum(a for _, a, _, _ in self.shape(text)) * size / self.upem + tracking * size * len(text)


sans600 = Face("Geist-Variable.woff2", 600)
sans400 = Face("Geist-Variable.woff2", 400)
mono400 = Face("GeistMono-Variable.woff2", 400)
mono600 = Face("GeistMono-Variable.woff2", 600)

# The X.Y.Z glyphs from site/src/hero-art.js.
GLYPHS = {
    "X": ["1...1", "1...1", ".1.1.", "..1..", ".1.1.", "1...1", "1...1"],
    "Y": ["1...1", "1...1", ".1.1.", "..1..", "..1..", "..1..", "..1.."],
    "Z": ["11111", "....1", "...1.", "..1..", ".1...", "1....", "11111"],
    ".": ["..", "..", "..", "..", "..", "11", "11"],
}
NOISE = "0123456789.-+*xyz"
SX, SY = 3, 2


def h(c, r):
    return ((c * 73856093) ^ (r * 19349663)) & 0xFFFFFFFF


def banner(t):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
           f'width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" '
           f'aria-label="semver.xyz: Versions are a communication mechanism.">',
           "<title>semver.xyz: Semantic Versions</title>",
           f'<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="16" fill="{t["bg"]}" stroke="{t["border"]}"/>']

    def text(face, s, size, x, y, fill, tracking=0.0):
        d, adv = face.run(s, size, x, y, tracking)
        out.append(f'<path fill="{fill}" d="{d}"/>')
        return adv

    # Wordmark, as in the site header.
    x = PAD
    x += text(sans600, "semver", 26, x, 92, t["text"], -0.02)
    text(sans400, ".xyz", 26, x, 92, t["muted"], -0.02)

    # Headline, as in the home hero.
    size, track = 64, -0.055
    text(sans600, "Versions are a", size, PAD, 186, t["text"], track)
    text(sans600, "communication", size, PAD, 249, t["muted"], track)
    text(sans600, "mechanism.", size, PAD, 312, t["muted"], track)

    # Anatomy of a version, as in the hero's code card.
    x, y, ms = PAD, 376, 20
    for face, s, fill in [
        (mono600, "npm:", t["text"]), (mono400, "react", t["text"]), (mono400, "@", t["faint"]),
        (mono400, "1", t["text"]), (mono400, ".", t["faint"]), (mono400, "2", t["text"]),
        (mono400, ".", t["faint"]), (mono400, "3", t["text"]), (mono400, "-", t["faint"]),
        (mono400, "beta.4", t["tok"]), (mono600, "+", t["text"]), (mono400, "build.7", t["muted"]),
    ]:
        x += text(face, s, ms, x, y, fill)

    # ASCII X.Y.Z on a character grid, right-aligned.
    seq = ["X", ".", "Y", ".", "Z"]
    gap = 3
    cols = sum(len(GLYPHS[g][0]) * SX for g in seq) + gap * (len(seq) - 1)
    rows = 7 * SY
    fs = 15
    cw = mono400.width("0", fs)
    lh = 17
    gx0 = W - PAD - cols * cw
    gy0 = 96
    used, cells = set(), []
    col, spans = 0, []
    for g in seq:
        gw = len(GLYPHS[g][0]) * SX
        if g != ".":
            spans.append((col, gw))
        for r in range(rows):
            for c in range(gw):
                if GLYPHS[g][r // SY][c // SX] == "1":
                    cells.append((col + c, r, g if g != "." else "•", t["text"] if g != "." else t["muted"]))
                    used.add((col + c, r))
        col += gw + gap
    # Sparse background noise across a slightly larger field.
    for r in range(-2, rows + 2):
        for c in range(-6, cols):
            if (c, r) in used:
                continue
            v = h(c + 11, r + 7)
            if v % 12 == 0:
                cells.append((c, r, NOISE[(v >> 5) % len(NOISE)], t["dim"]))

    defs, ids = [], {}
    for _, _, ch, _ in cells:
        if ch not in ids:
            name = mono400.shape(ch)[0][0]
            ids[ch] = f"g{len(ids)}"
            defs.append(f'<path id="{ids[ch]}" d="{mono400.path(name, fs, 0, 0)}"/>')
    out.append("<defs>" + "".join(defs) + "</defs>")
    by_fill = {}
    for c, r, ch, fill in cells:
        by_fill.setdefault(fill, []).append(
            f'<use xlink:href="#{ids[ch]}" x="{gx0 + c * cw:.1f}" y="{gy0 + (r + 1) * lh:.1f}"/>')
    for fill, uses in by_fill.items():
        out.append(f'<g fill="{fill}">' + "".join(uses) + "</g>")

    # major / minor / patch under each part.
    ly = gy0 + (rows + 2) * lh + 34
    for (c, gw), label in zip(spans, ["major", "minor", "patch"]):
        lw = mono400.width(label, 14)
        text(mono400, label, 14, gx0 + (c + gw / 2) * cw - lw / 2, ly, t["faint"])

    out.append("</svg>")
    return "\n".join(out)


OUT.mkdir(parents=True, exist_ok=True)
for name, theme in THEMES.items():
    (OUT / f"banner-{name}.svg").write_text(banner(theme))
    print(name, (OUT / f"banner-{name}.svg").stat().st_size)
