// Interactive ASCII "X.Y.Z" behind the home hero.
//
// Each glyph is drawn on a character grid out of its own character (a big X
// made of Xs, a 1 made of 1s). Moving the pointer scrambles nearby cells and
// surfaces version characters (0-9 . - +) in the background; hovering a part
// decodes it into its current number; clicking bumps that part and resets the
// lower ones to 0 (the spec's increment rules). After a few idle seconds it
// settles back to X.Y.Z. Purely decorative: aria-hidden, no keyboard focus,
// and it only animates while something is happening.

const GLYPHS = {
  X: ["1...1", "1...1", ".1.1.", "..1..", ".1.1.", "1...1", "1...1"],
  Y: ["1...1", "1...1", ".1.1.", "..1..", "..1..", "..1..", "..1.."],
  Z: ["11111", "....1", "...1.", "..1..", ".1...", "1....", "11111"],
  ".": ["..", "..", "..", "..", "..", "11", "11"],
  0: [".111.", "1...1", "1..11", "1.1.1", "11..1", "1...1", ".111."],
  1: ["..1..", ".11..", "..1..", "..1..", "..1..", "..1..", ".111."],
  2: [".111.", "1...1", "....1", "...1.", "..1..", ".1...", "11111"],
  3: ["11111", "...1.", "..1..", "...1.", "....1", "1...1", ".111."],
  4: ["...1.", "..11.", ".1.1.", "1..1.", "11111", "...1.", "...1."],
  5: ["11111", "1....", "1111.", "....1", "....1", "1...1", ".111."],
  6: ["..11.", ".1...", "1....", "1111.", "1...1", "1...1", ".111."],
  7: ["11111", "....1", "...1.", "..1..", ".1...", ".1...", ".1..."],
  8: [".111.", "1...1", "1...1", ".111.", "1...1", "1...1", ".111."],
  9: [".111.", "1...1", "1...1", ".1111", "....1", "...1.", ".11.."],
};
const FILL = "0123456789.-+";
const DOT = "•";
const NOISE = "0123456789.-+*xyz";
const SYMBOLS = ["X", "Y", "Z"];
const LABELS = ["major", "minor", "patch"];
const NOTES = [
  "major bump · minor & patch reset to 0",
  "minor bump · patch reset to 0",
  "patch bump",
];
const SX = 3; // grid cells per glyph pixel, horizontally
const SY = 2; // and vertically
const MAX_FONT_PX = 12;
const MIN_FONT_PX = 8;
const RADIUS = 96; // pointer influence, in CSS px
const REVERT_MS = 2800;

const root = document.querySelector("[data-hero-art]");
if (root) init(root);

function init(root) {
  const hero = root.closest(".hero") ?? root.parentElement;
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let W = 0, H = 0, cw = 7.2, cols = 0, rows = 0, offX = 0, offY = 0;
  let fontPx = MAX_FONT_PX, linePx = 13;
  let cells = [];
  let segRanges = [];
  let glyphTop = 0;
  let glyphRows = 7 * SY;
  let colors = {};
  const values = [1, 4, 2];
  const showNum = [false, false, false];
  const flashUntil = [0, 0, 0];
  let hoverSeg = -1;
  let pointer = null;
  let lastActive = 0;
  let caption = null;
  let raf = 0;
  let visible = true;

  const rand = (s) => s[(Math.random() * s.length) | 0];
  const hash = (c, r) => ((c * 73856093) ^ (r * 19349663)) >>> 0;

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    colors = {
      text: v("--text"),
      muted: v("--muted"),
      faint: v("--faint"),
      dim: v("--border-2"),
      signal: v("--signal"),
    };
  }

  const display = (i) => (showNum[i] ? String(values[i]) : SYMBOLS[i]);

  function layout() {
    if (!cols || !rows) return;
    const items = [];
    let wpx = 0;
    for (let i = 0; i < 3; i++) {
      for (const ch of display(i)) {
        items.push({ g: GLYPHS[ch], ch, seg: i, x: wpx });
        wpx += GLYPHS[ch][0].length + 1;
      }
      if (i < 2) {
        items.push({ g: GLYPHS["."], ch: DOT, seg: -1, x: wpx });
        wpx += GLYPHS["."][0].length + 1;
      }
    }
    wpx -= 1;
    // Right-aligned, leaving room above for the bump caption.
    const c0 = Math.max(1, cols - wpx * SX - 1);
    glyphTop = 3;

    const target = new Array(cols * rows).fill(null);
    const segOf = new Array(cols * rows).fill(-1);
    segRanges = [[Infinity, -1], [Infinity, -1], [Infinity, -1]];
    for (const it of items) {
      const gx = c0 + it.x * SX;
      const gw = it.g[0].length;
      if (it.seg >= 0) {
        const r = segRanges[it.seg];
        r[0] = Math.min(r[0], gx);
        r[1] = Math.max(r[1], gx + gw * SX - 1);
      }
      for (let py = 0; py < 7; py++) {
        for (let px = 0; px < gw; px++) {
          if (it.g[py][px] !== "1") continue;
          for (let sy = 0; sy < SY; sy++) {
            for (let sx = 0; sx < SX; sx++) {
              const c = gx + px * SX + sx;
              const r = glyphTop + py * SY + sy;
              if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
              const k = r * cols + c;
              target[k] = it.ch;
              segOf[k] = it.seg;
            }
          }
        }
      }
    }

    const now = performance.now();
    for (let k = 0; k < cells.length; k++) {
      const cell = cells[k];
      const kind = target[k] ? 1 : 0;
      if (cell.kind !== kind && !reduce.matches) {
        cell.until = now + 60 + Math.random() * 360;
      }
      cell.kind = kind;
      cell.target = target[k] ?? ".";
      cell.seg = segOf[k];
      if (reduce.matches) cell.ch = cell.target;
    }
    wake();
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Size the grid so the widest likely display (X.Y.Z, ~23 glyph pixels)
    // fits with a little margin.
    ctx.font = `${MAX_FONT_PX}px "Geist Mono", ui-monospace, monospace`;
    const ratio = (ctx.measureText("0").width || 7.2) / MAX_FONT_PX;
    fontPx = Math.max(MIN_FONT_PX, Math.min(MAX_FONT_PX, W / ((23 * SX + 4) * ratio)));
    linePx = Math.round(fontPx * 1.08);
    ctx.font = `${fontPx}px "Geist Mono", ui-monospace, monospace`;
    cw = ctx.measureText("0").width || fontPx * 0.6;
    cols = Math.floor(W / cw);
    rows = Math.floor(H / linePx);
    offX = (W - cols * cw) / 2;
    offY = 0;
    cells = Array.from({ length: cols * rows }, () => ({
      ch: ".", target: ".", kind: 0, seg: -1, until: 0,
    }));
    layout();
  }

  function draw(now) {
    let busy = false;
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = "top";
    ctx.font = `${fontPx}px "Geist Mono", ui-monospace, monospace`;
    const motion = !reduce.matches;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r * cols + c];
        const x = offX + c * cw;
        const y = offY + r * linePx;
        let near = 0;
        if (pointer) {
          const d = Math.hypot(x + cw / 2 - pointer.x, y + linePx / 2 - pointer.y);
          if (d < RADIUS) near = 1 - d / RADIUS;
        }

        if (now < cell.until) {
          busy = true;
          if (Math.random() < 0.45) cell.ch = rand(NOISE);
        } else if (near > 0 && motion && (cell.kind || hash(c, r) % 3 === 0)) {
          // Near the pointer: glyphs shimmer, a sparse third of the
          // background surfaces version characters.
          if (Math.random() < 0.08 * near) cell.ch = rand(cell.kind ? FILL : NOISE);
        } else {
          cell.ch = cell.target;
        }

        let color, alpha;
        if (cell.kind) {
          const flashing = cell.seg >= 0 && now < flashUntil[cell.seg];
          if (flashing) {
            color = colors.signal;
            alpha = 0.95;
          } else if (cell.seg >= 0 && cell.seg === hoverSeg) {
            color = colors.muted;
            alpha = 0.95;
          } else {
            color = colors.faint;
            alpha = 0.75 + near * 0.25;
          }
        } else {
          const lit = cell.ch !== ".";
          color = lit ? colors.faint : colors.dim;
          alpha = lit ? 0.35 + near * 0.6 : 0.5;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillText(cell.ch, x, y);
      }
    }

    // Labels under each part.
    const labelY = offY + (glyphTop + glyphRows + 1) * linePx;
    ctx.font = `13px "Geist Pixel", "Geist Mono", monospace`;
    for (let i = 0; i < 3; i++) {
      const [a, b] = segRanges[i];
      if (b < 0) continue;
      const cx = offX + ((a + b + 1) / 2) * cw;
      const hot = i === hoverSeg;
      ctx.globalAlpha = hot ? 1 : 0.85;
      ctx.fillStyle = hot ? colors.text : colors.faint;
      const w = ctx.measureText(LABELS[i]).width;
      ctx.fillText(LABELS[i], cx - w / 2, labelY);
      if (hot) {
        ctx.font = `11px "Geist Mono", monospace`;
        ctx.fillStyle = colors.muted;
        const hint = "click to bump";
        ctx.fillText(hint, cx - ctx.measureText(hint).width / 2, labelY + 18);
        ctx.font = `13px "Geist Pixel", "Geist Mono", monospace`;
      }
    }

    // Caption after a bump.
    if (caption && now < caption.until) {
      busy = true;
      const t = (caption.until - now) / 2600;
      const a = Math.min(1, t * 3);
      ctx.globalAlpha = a;
      ctx.font = `500 13px "Geist Mono", monospace`;
      ctx.fillStyle = colors.signal;
      const w1 = ctx.measureText(caption.text).width;
      const top = offY + 2;
      ctx.fillText(caption.text, W - w1 - cw, top);
      ctx.font = `12px "Geist Pixel", "Geist Mono", monospace`;
      ctx.fillStyle = colors.muted;
      const w2 = ctx.measureText(caption.note).width;
      ctx.fillText(caption.note, W - w2 - cw, top + 16);
    } else {
      caption = null;
    }
    ctx.globalAlpha = 1;

    if (flashUntil.some((f) => now < f)) busy = true;

    // Settle back to X.Y.Z after a quiet spell.
    if (!pointer && showNum.some(Boolean)) {
      if (now - lastActive > REVERT_MS) {
        showNum.fill(false);
        layout();
      }
      busy = true;
    }
    return busy || !!pointer;
  }

  function frame(now) {
    raf = 0;
    if (!visible || root.offsetParent === null) return;
    if (draw(now)) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  function segAt(px, py) {
    const c = Math.floor((px - offX) / cw);
    const r = Math.floor((py - offY) / linePx);
    if (r < glyphTop - 1 || r > glyphTop + glyphRows + 3) return -1;
    for (let i = 0; i < 3; i++) {
      const [a, b] = segRanges[i];
      if (c >= a - 1 && c <= b + 1) return i;
    }
    return -1;
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inside = x >= -RADIUS && y >= -RADIUS && x <= rect.width + RADIUS && y <= rect.height + RADIUS;
    pointer = inside ? { x, y } : null;
    const seg = inside ? segAt(x, y) : -1;
    if (seg !== hoverSeg) {
      hoverSeg = seg;
      if (seg >= 0 && !showNum[seg]) {
        showNum[seg] = true;
        layout();
      }
    }
    const interactive = e.target.closest?.("a, button, input, textarea, [data-copy]");
    hero.style.cursor = hoverSeg >= 0 && !interactive ? "pointer" : "";
    lastActive = performance.now();
    wake();
  }

  function onLeave() {
    pointer = null;
    hoverSeg = -1;
    hero.style.cursor = "";
    lastActive = performance.now();
    wake();
  }

  function onClick(e) {
    if (hoverSeg < 0) return;
    if (e.target.closest("a, button, input, textarea, [data-copy]")) return;
    if (String(window.getSelection?.() ?? "") !== "") return;
    const i = hoverSeg;
    const before = values.join(".");
    values[i] += 1;
    for (let j = i + 1; j < 3; j++) values[j] = 0;
    const now = performance.now();
    for (let j = 0; j < 3; j++) {
      showNum[j] = true;
      if (j >= i) flashUntil[j] = now + 900;
    }
    caption = { text: `${before} → ${values.join(".")}`, note: NOTES[i], until: now + 2600 };
    lastActive = now;
    layout();
  }

  hero.addEventListener("pointermove", onMove);
  hero.addEventListener("pointerleave", onLeave);
  hero.addEventListener("click", onClick);

  new ResizeObserver(resize).observe(root);
  new IntersectionObserver((entries) => {
    visible = entries.some((en) => en.isIntersecting);
    if (visible) wake();
  }).observe(root);

  const retheme = () => {
    readColors();
    wake();
  };
  new MutationObserver(retheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);

  readColors();
  resize();
  document.fonts?.ready.then(() => {
    resize();
    wake();
  });
}
