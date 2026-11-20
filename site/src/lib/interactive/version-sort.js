// Precedence sort — the interactive graphic beside the "Why a new spec" copy.
//
// A small set of real versions repeatedly shuffles and then animates back into
// correct low-to-high precedence order, so the `precedence · live` label is
// literal: you watch the ordering happen. The pool is chosen to show the rules
// this spec cares about — prerelease progression, prerelease below release, and
// the restored build precedence (1.0.0 < 1.0.0+build.7).
//
// DOM-based (rows are absolutely positioned and moved with transforms), so the
// text stays crisp and hover interaction is free. Monochrome by design; the
// panel is dark in both themes. Idles when off-screen, when the tab is hidden,
// or when the visitor prefers reduced motion.

/**
 * Mounts the sort into `root` (the `.why-sort` panel) and returns a function
 * that stops it and removes the rows again.
 */
export function init(root) {
  const tagEl = document.querySelector("[data-sort-tag]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const POOL = [
    "1.0.0-alpha",
    "1.0.0-beta.2",
    "1.0.0-rc.1",
    "1.0.0",
    "1.0.0+build.7",
    "1.2.0",
    "2.0.0-rc.1",
    "2.0.0",
  ];

  const N = POOL.length;

  // ---- parsing + precedence ----
  const RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

  function parse(raw) {
    const m = RE.exec(raw);
    const core = [+m[1], +m[2], +m[3]];
    const pre = m[4] ? m[4].split(".") : [];
    const build = m[5] ? m[5].split(".") : [];
    return { raw, core, pre, build };
  }

  const isNum = (s) => /^\d+$/.test(s);

  function cmpId(a, b) {
    const an = isNum(a);
    const bn = isNum(b);
    if (an && bn) return +a - +b;
    if (an) return -1; // numeric identifiers rank below alphanumeric
    if (bn) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // Compare two identifier lists. `emptyLower` decides which side an empty list
  // falls on: prerelease empty means "release" and ranks HIGHER (emptyLower =
  // false); build empty means "no build" and ranks LOWER (emptyLower = true).
  function cmpIds(a, b, emptyLower) {
    if (!a.length && !b.length) return 0;
    if (!a.length) return emptyLower ? -1 : 1;
    if (!b.length) return emptyLower ? 1 : -1;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const c = cmpId(a[i], b[i]);
      if (c) return c;
    }
    return a.length - b.length;
  }

  function compare(x, y) {
    for (let i = 0; i < 3; i++) {
      if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i];
    }
    const p = cmpIds(x.pre, y.pre, false);
    if (p) return p;
    return cmpIds(x.build, y.build, true);
  }

  const entries = POOL.map(parse);
  // rank[i] = final slot (0 = lowest precedence) of entry i
  const order = entries.map((_, i) => i).sort((a, b) => compare(entries[a], entries[b]));
  const rank = new Array(N);
  order.forEach((entryIdx, slot) => (rank[entryIdx] = slot));

  // ---- build rows ----
  const rows = entries.map((e, i) => {
    const row = document.createElement("div");
    row.className = "why-row";
    row.dataset.i = String(i);

    const seg = (cls, text) =>
      text ? `<span class="${cls}">${text}</span>` : "";
    const preTxt = e.pre.length ? "-" + e.pre.join(".") : "";
    const buildTxt = e.build.length ? "+" + e.build.join(".") : "";

    row.innerHTML =
      `<span class="v-rank">${rank[i] + 1}</span>` +
      `<span class="v-str">` +
      seg("v-core", e.core.join(".")) +
      seg("v-pre", preTxt) +
      seg("v-build", buildTxt) +
      `</span>` +
      `<span class="v-lt" aria-hidden="true">&lt;</span>`;

    root.appendChild(row);
    return row;
  });

  // ---- layout ----
  let rowH = 0;
  function measure() {
    const cs = getComputedStyle(root);
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const h = root.clientHeight - padT - padB;
    rowH = h > 0 ? h / N : 0;
    rows.forEach((r) => (r.style.height = `${rowH}px`));
  }

  // Place each entry at a slot. `slotOf[entryIdx] = slot`. Stagger settles the
  // list top-first so the sort reads as a cascade.
  function place(slotOf, { stagger = 0, animate = true } = {}) {
    rows.forEach((r, i) => {
      const slot = slotOf[i];
      r.style.transitionDelay = animate ? `${slot * stagger}ms` : "0ms";
      r.style.transform = `translateY(${slot * rowH}px)`;
    });
  }

  const sortedSlots = rank.slice(); // entry i -> its precedence slot
  function shuffledSlots() {
    const slots = entries.map((_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    return slots;
  }

  function tag(text) {
    if (tagEl) tagEl.textContent = text;
  }

  // ---- animation cycle ----
  let timer = null;
  let running = false;
  let onScreen = true;
  let hovering = false;

  const clear = () => {
    clearTimeout(timer);
    timer = null;
  };
  const wait = (ms, fn) => {
    timer = setTimeout(fn, ms);
  };

  function toShuffled() {
    if (!running) return;
    tag("precedence · shuffling");
    place(shuffledSlots(), { stagger: 26 });
    wait(1200, toSorted);
  }

  function toSorted() {
    if (!running) return;
    tag("precedence · sorting");
    place(sortedSlots, { stagger: 55 });
    wait(700 + (N - 1) * 55, () => {
      tag("precedence · ordered");
      wait(2200, toShuffled);
    });
  }

  function start() {
    if (running || hovering || reduce.matches || !onScreen || document.hidden)
      return;
    running = true;
    wait(600, toShuffled);
  }

  function stop() {
    running = false;
    clear();
  }

  // ---- hover: pause, snap to sorted, reveal the neighbour comparison ----
  function setHot(i) {
    rows.forEach((r) => r.classList.remove("hot", "hot-next"));
    if (i == null) {
      tag("precedence · ordered");
      return;
    }
    const r = rank[i];
    const nextEntry = order[r + 1] ?? order[r - 1];
    const lower = r + 1 <= N - 1 ? i : nextEntry;
    const higher = r + 1 <= N - 1 ? nextEntry : i;
    rows[i].classList.add("hot");
    if (nextEntry != null) rows[nextEntry].classList.add("hot-next");
    tag(`${POOL[lower]} · < · ${POOL[higher]}`);
  }

  rows.forEach((row) => {
    row.addEventListener("pointerenter", () => {
      if (reduce.matches) return;
      setHot(+row.dataset.i);
    });
  });

  root.addEventListener("pointerenter", () => {
    if (reduce.matches) return;
    hovering = true;
    stop();
    place(sortedSlots, { stagger: 0 });
  });
  root.addEventListener("pointerleave", () => {
    if (reduce.matches) return;
    hovering = false;
    rows.forEach((r) => r.classList.remove("hot", "hot-next"));
    tag("precedence · live");
    start();
  });

  // ---- lifecycle ----
  const ro = new ResizeObserver(() => {
    // Re-place without transition so a resize doesn't fling rows around.
    root.classList.remove("live");
    measure();
    // Snapping to the sorted layout on resize is fine: the loop is transform-only
    // and will pick the current slots back up on its next tick.
    place(sortedSlots, { animate: false });
    requestAnimationFrame(() => root.classList.add("live"));
  });
  ro.observe(root);

  const io = new IntersectionObserver(
    (e) => {
      onScreen = e[0].isIntersecting;
      if (onScreen) start();
      else stop();
    },
    { threshold: 0.05 },
  );
  io.observe(root);

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onReduce = () => {
    stop();
    measure();
    place(sortedSlots, { animate: false });
    tag("precedence · live");
    if (!reduce.matches) start();
  };
  reduce.addEventListener?.("change", onReduce);

  // ---- initial paint ----
  measure();
  place(sortedSlots, { animate: false });
  tag("precedence · live");
  // Enable transitions only after the first placement so the list doesn't
  // animate in from the top-left on load.
  requestAnimationFrame(() => root.classList.add("live"));
  if (!reduce.matches) start();

  return () => {
    stop();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    reduce.removeEventListener?.("change", onReduce);
    root.classList.remove("live");
    root.replaceChildren();
  };
}
