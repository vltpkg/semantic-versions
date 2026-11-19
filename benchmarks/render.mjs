// Renders benchmark + conformance results (results/*.json) as Markdown for the
// READMEs and as HTML for semver.xyz/libraries. One renderer, so the numbers are
// presented identically everywhere.

export const CATEGORIES = [
  ['parse', 'Version grammar', 'Valid and invalid versions per the BNF'],
  ['strict', 'No coercion', 'Rejects `v1.2.3`, `=1.2.3`, `1.2.3pre`, …'],
  ['precedence', 'Precedence', 'Major, minor, patch and pre-release ordering'],
  ['build-precedence', 'Build precedence', 'A build ranks above its release: `1.0.0 < 1.0.0+b`'],
  ['ranges', 'Ranges', 'Comparators, `||`, x-ranges, `~`, `^`, hyphen ranges'],
  ['approximate', 'Approximate ranges', 'The pessimistic operator `~>`'],
  ['prerelease-channels', 'Pre-release channels', '`^1.0.0-rc` admits `rc.*`, never `beta`'],
  ['prerelease-wildcards', 'Pre-release wildcards', '`X.Y.Z-*` and `*-*` opt in explicitly'],
  ['build-channels', 'Build channels', '`^1.0.0+win` admits `+win.*` builds only'],
  ['context', 'Contexts', '`npm:react@18.2.0`, `npm:react@^18`'],
]

// Pipes must be escaped inside Markdown table cells, even within code spans.
const cell = (s) => String(s).replace(/\|/g, '\\|')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const code = (s, html) => (html ? esc(s).replace(/`([^`]+)`/g, '<code>$1</code>') : s)

const fmtNs = (ns) => {
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(ns >= 1e4 ? 1 : 2)} µs`
  return `${ns.toFixed(ns >= 100 ? 0 : 1)} ns`
}

/** How the subject compares to `baseline` on one task. */
export const relative = (subjectNs, baselineNs) => {
  const r = baselineNs / subjectNs
  if (r >= 1.05) return { kind: 'faster', text: `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}× faster` }
  if (r <= 1 / 1.05) return { kind: 'slower', text: `${(1 / r).toFixed(2)}× slower` }
  return { kind: 'same', text: 'about the same' }
}

export const environment = (res) => {
  const e = res.environment
  return `${e.runtime} · ${e.cpu} · ${e.platform} · ${e.date}`
}

// The implementation first, then its main comparison, then the rest.
const libs = (res) => {
  const all = Object.keys(res.libraries)
  return [res.subject, res.baseline, ...all.filter((n) => n !== res.subject && n !== res.baseline)]
}
const libLabel = (res, name) => `${name}@${res.libraries[name].version}`

// ------------------------------------------------------------------ speed

export const speedMarkdown = (res) => {
  const names = libs(res)
  const rows = [
    `| Operation | ${names.map((n) => `\`${libLabel(res, n)}\``).join(' | ')} | ${res.subject} vs ${res.baseline} |`,
    `| --- | ${names.map(() => '---:').join(' | ')} | --- |`,
  ]
  for (const t of res.tasks) {
    const cells = names.map((n) => {
      const r = t.results[n]
      if (!r) return '—'
      return n === res.subject ? `**${fmtNs(r.nsPerOp)}**` : fmtNs(r.nsPerOp)
    })
    const rel = relative(t.results[res.subject].nsPerOp, t.results[res.baseline].nsPerOp)
    rows.push(`| ${t.label} | ${cells.join(' | ')} | ${rel.kind === 'faster' ? `**${rel.text}**` : rel.text} |`)
  }
  const notes = Object.entries(res.notes || {}).map(([n, note]) => `\`${n}\`: ${note}`)
  return [
    rows.join('\n'),
    '',
    `<sub>Median time per operation (lower is better) on ${res.corpus.versions.toLocaleString('en-US')} published versions and ${res.corpus.comparableRanges.toLocaleString('en-US')} dependency ranges from the npm registry. ${environment(res)}.${notes.length ? ' ' + notes.join(' ') : ''}</sub>`,
  ].join('\n')
}

export const speedHtml = (res) => {
  const names = libs(res)
  const head = names.map((n) => `<th class="num${n === res.subject ? ' subject' : ''}"><code>${esc(n)}</code><span>${esc(res.libraries[n].version)}</span></th>`).join('')
  const body = res.tasks.map((t) => {
    const cells = names.map((n) => {
      const r = t.results[n]
      if (!r) return '<td class="num na">—</td>'
      return `<td class="num${n === res.subject ? ' subject' : ''}">${fmtNs(r.nsPerOp)}</td>`
    }).join('')
    const rel = relative(t.results[res.subject].nsPerOp, t.results[res.baseline].nsPerOp)
    return `<tr><th scope="row">${esc(t.label)}<span>${esc(t.description)}</span></th>${cells}<td class="rel rel-${rel.kind}">${esc(rel.text)}</td></tr>`
  }).join('\n')
  const notes = Object.entries(res.notes || {}).map(([n, note]) => `<code>${esc(n)}</code>: ${code(note, true)}`)
  return `<div class="doc-table-wrap bench-wrap"><table class="doc-table bench-table">
<thead><tr><th>Operation</th>${head}<th>vs <code>${esc(res.baseline)}</code></th></tr></thead>
<tbody>
${body}
</tbody></table></div>
<p class="bench-meta">Median time per operation, lower is better. ${res.corpus.versions.toLocaleString('en-US')} published versions and ${res.corpus.comparableRanges.toLocaleString('en-US')} dependency ranges from the npm registry. ${esc(environment(res))}.${notes.length ? ' ' + notes.join(' ') : ''}</p>`
}

// ------------------------------------------------------------ conformance

const score = (c) => {
  if (!c) return { kind: 'na', text: 'n/a' }
  if (c.passed === c.total) return { kind: 'pass', text: `${c.passed}/${c.total}` }
  if (c.passed === 0) return { kind: 'fail', text: `${c.passed}/${c.total}` }
  return { kind: 'partial', text: `${c.passed}/${c.total}` }
}
const MARK = { pass: '✓', partial: '◐', fail: '✗', na: '—' }

const totals = (byCat) => Object.values(byCat).reduce((a, c) => ({ passed: a.passed + c.passed, total: a.total + c.total }), { passed: 0, total: 0 })

export const conformanceMarkdown = (res) => {
  const names = libs(res)
  const rows = [
    `| Semantic Versions feature | ${names.map((n) => `\`${n}\``).join(' | ')} |`,
    `| --- | ${names.map(() => ':---:').join(' | ')} |`,
  ]
  for (const [id, label, desc] of CATEGORIES) {
    if (!names.some((n) => res.conformance[n][id])) continue
    rows.push(`| ${label} <br><sub>${cell(desc)}</sub> | ${names.map((n) => { const s = score(res.conformance[n][id]); return `${MARK[s.kind]} ${s.text}` }).join(' | ')} |`)
  }
  rows.push(`| **All cases** | ${names.map((n) => { const t = totals(res.conformance[n]); return `**${t.passed}/${t.total}**` }).join(' | ')} |`)
  return [rows.join('\n'), '', '<sub>Cases from the shared conformance suite in [`conformance/`](https://github.com/vltpkg/semantic-versions/tree/main/conformance), drawn from the specification. ✓ all pass · ◐ some pass · ✗ none pass.</sub>'].join('\n')
}

export const conformanceHtml = (res) => {
  const names = libs(res)
  const head = names.map((n) => `<th class="mark${n === res.subject ? ' subject' : ''}"><code>${esc(n)}</code></th>`).join('')
  const body = CATEGORIES.filter(([id]) => names.some((n) => res.conformance[n][id])).map(([id, label, desc]) => {
    const cells = names.map((n) => {
      const s = score(res.conformance[n][id])
      return `<td class="mark mark-${s.kind}${n === res.subject ? ' subject' : ''}"><span aria-hidden="true">${MARK[s.kind]}</span> ${s.text}</td>`
    }).join('')
    return `<tr><th scope="row">${esc(label)}<span>${code(desc, true)}</span></th>${cells}</tr>`
  }).join('\n')
  const total = names.map((n) => { const t = totals(res.conformance[n]); return `<td class="mark${n === res.subject ? ' subject' : ''}"><strong>${t.passed}/${t.total}</strong></td>` }).join('')
  return `<div class="doc-table-wrap bench-wrap"><table class="doc-table conf-table">
<thead><tr><th>Feature</th>${head}</tr></thead>
<tbody>
${body}
<tr class="conf-total"><th scope="row">All cases</th>${total}</tr>
</tbody></table></div>`
}

export const coverageNote = (res) => {
  const names = libs(res)
  return names.map((n) => `${n} accepts ${res.coverage[n].ranges.toLocaleString('en-US')} of ${res.corpus.ranges.toLocaleString('en-US')} real ranges`).join('; ')
}

// ------------------------------------------------------- summaries & page

const ratio = (r) => (r >= 10 ? r.toFixed(0) : r.toFixed(1))

/** How the subject compares to the baseline across every task both ran. */
export const summary = (res) => {
  const rs = res.tasks
    .filter((t) => t.results[res.subject] && t.results[res.baseline])
    .map((t) => t.results[res.baseline].nsPerOp / t.results[res.subject].nsPerOp)
  const faster = rs.filter((r) => r >= 1.05)
  const slower = rs.filter((r) => r <= 1 / 1.05)
  return {
    n: rs.length,
    faster: faster.length,
    slower: slower.length,
    min: Math.min(...rs),
    max: Math.max(...rs),
    slowest: slower.length ? 1 / Math.min(...slower) : 1,
  }
}

/** A one-line, honest speed summary: "2.0–16× faster than `x`". */
export const headline = (res, html = false) => {
  const s = summary(res)
  const base = html ? `<code class="title-code">${esc(res.baseline)}</code>` : `\`${res.baseline}\``
  if (s.slower === 0 && s.faster === s.n) {
    return s.min.toFixed(1) === s.max.toFixed(1) || ratio(s.min) === ratio(s.max)
      ? `${ratio(s.max)}× faster than ${base}`
      : `${ratio(s.min)}–${ratio(s.max)}× faster than ${base}`
  }
  if (s.slower === 0) return `Up to ${ratio(s.max)}× faster than ${base}`
  return `Up to ${ratio(s.max)}× faster than ${base}, at most ${s.slowest.toFixed(2)}× slower`
}

/** "2.0–16×" for compact places (cards, the overview table). */
export const speedRange = (res) => {
  const s = summary(res)
  if (s.slower) return `${ratio(1 / s.slowest)}–${ratio(s.max)}×`
  return ratio(s.min) === ratio(s.max) ? `${ratio(s.max)}×` : `${ratio(s.min)}–${ratio(s.max)}×`
}

export const conformanceTotal = (res, name = res.subject) => totals(res.conformance[name])

export const icon = (ICONS, id, cls = 'lang-icon') => {
  const i = ICONS[id]
  return i ? `<svg class="${cls}" viewBox="0 0 24 24" role="img" aria-label="${esc(i.title)}" fill="currentColor"><path d="${i.path}"/></svg>` : ''
}

/** The library cards on semver.xyz/libraries. */
export const toolCardsHtml = (langs, results, ICONS) => langs.map((l) => {
  const res = results[l.id]
  const pass = res ? conformanceTotal(res) : null
  const links = [...l.links, ['Source', `https://github.com/vltpkg/semantic-versions/tree/main/${l.source}`]]
    .map(([t, h]) => `<a href="${h}" target="_blank" rel="noopener">${esc(t)}</a>`).join('')
  const stats = res
    ? `<dl class="tool-stats">
  <div><dt>Conformance</dt><dd>${pass.passed}/${pass.total}</dd></div>
  <div><dt>vs <code>${esc(res.baseline)}</code></dt><dd>${esc(speedRange(res))}</dd></div>
</dl>`
    : ''
  return `<article class="tool-card reveal" id="tool-${l.id}">
<div class="tool-top">${icon(ICONS, l.id)}<span class="tool-lang">${esc(l.name)}</span><span class="tool-registry">${esc(l.registry)}</span></div>
<p>${l.tagline}</p>
<div class="code-window" data-copy>
  <div class="code-bar"><span class="code-title">${esc(l.installLabel || 'install')}</span><button class="copy-btn" type="button" aria-label="Copy">Copy</button></div>
  <pre class="code"><code>${esc(l.install)}</code></pre>
</div>
${stats}
<div class="tool-links">${links}<a href="#${l.id}">Benchmarks</a></div>
</article>`
}).join('\n')

/** The at-a-glance comparison table on semver.xyz/libraries. */
export const overviewHtml = (langs, results, ICONS) => {
  const rows = langs.filter((l) => results[l.id]).map((l) => {
    const res = results[l.id]
    const ours = conformanceTotal(res)
    const theirs = conformanceTotal(res, res.baseline)
    const s = summary(res)
    return `<tr>
<th scope="row"><a href="#${l.id}">${icon(ICONS, l.id)}${esc(l.name)}</a></th>
<td><code>${esc(l.package)}</code></td>
<td class="mark subject">${ours.passed}/${ours.total}</td>
<td><code>${esc(res.baseline)}</code> <span class="faint">${theirs.passed}/${theirs.total}</span></td>
<td class="num rel ${s.slower ? '' : 'rel-faster'}">${esc(speedRange(res))}</td>
</tr>`
  }).join('\n')
  return `<div class="doc-table-wrap bench-wrap"><table class="doc-table overview-table">
<thead><tr><th>Language</th><th>Package</th><th class="mark">Conformance</th><th>Compared with</th><th class="num">Speed vs. it</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>`
}

/** One section per language: headline, method, speed and conformance tables. */
export const toolSectionsHtml = (langs, results, ICONS) => langs.filter((l) => results[l.id]).map((l) => {
  const res = results[l.id]
  return `<section class="wrap lang-section" id="${l.id}">
<div class="section-head left reveal">
  <p class="eyebrow lang-eyebrow">${icon(ICONS, l.id)}${esc(l.name)}</p>
  <h2 class="section-title big">${headline(res, true)}.</h2>
  <p class="lead">${l.method}</p>
</div>
<div class="reveal">${speedHtml(res)}</div>
<h3 class="bench-sub reveal">Conformance</h3>
<p class="bench-intro reveal">The other libraries implement Semantic Versioning 2.0.0 or their ecosystem's own rules, so they fail where this spec deliberately differs (build precedence, channels and contexts) and wherever they coerce input. That is the gap the spec closes, not a defect in them.</p>
<div class="reveal">${conformanceHtml(res)}</div>
</section>`
}).join('\n')

/** The language table at the top of benchmarks/README.md and the root README. */
export const languagesMarkdown = (langs, results, base = '') => {
  const rows = ['| Language | Package | Conformance | Compared with | Speed vs. it |', '| --- | --- | :---: | --- | ---: |']
  for (const l of langs) {
    const res = results[l.id]
    if (!res) continue
    const ours = conformanceTotal(res)
    const theirs = conformanceTotal(res, res.baseline)
    rows.push(`| [${l.name}](${base}${l.source}) | \`${cell(l.package)}\` (${l.registry}) | ${ours.passed}/${ours.total} | \`${res.baseline}\` ${theirs.passed}/${theirs.total} | ${speedRange(res)} |`)
  }
  return rows.join('\n')
}

/** The row of language marks beside the home page's calls to action. */
export const heroLanguagesHtml = (langs, ICONS) => {
  const names = langs.map((l) => l.name)
  const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const marks = langs.map((l) => `<a class="hero-lang" href="/libraries/#${l.id}" title="${esc(l.name)}">${icon(ICONS, l.id, 'lang-icon')}</a>`).join('')
  return `<div class="hero-langs" role="group" aria-label="Libraries for ${esc(list)}">
<a class="hero-langs-label" href="/libraries/">Libraries for</a>${marks}
</div>`
}
