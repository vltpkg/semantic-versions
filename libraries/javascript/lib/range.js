import { Comparator } from './compare.js'
import { Version, splitReference } from './version.js'

// Parsed ranges are immutable, so cache them by their source string, as
// node-semver does: `satisfies(v, r)` is usually called with the same handful
// of ranges many times over.
const CACHE_MAX = 1000
const cache = new Map()
const cached = (raw) => {
  const hit = cache.get(raw)
  if (hit !== undefined) {
    // refresh recency
    cache.delete(raw)
    cache.set(raw, hit)
  }
  return hit
}
const remember = (raw, range) => {
  cache.set(raw, range)
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value)
  }
}
import {
  MAX_LENGTH,
  HYPHENRANGE,
  COMPARATORTRIM,
  TILDETRIM,
  CARETTRIM,
  TILDE,
  CARET,
  XRANGE,
  WILDCARD,
  COMPARATOR,
  GTE0,
  STARPRE,
  TUPLEPRE
} from './regex.js'

// These trims must run globally; the shared regexes are anchored/non-global,
// so rebuild global variants from their source.
const COMPARATORTRIM_G = new RegExp(COMPARATORTRIM.source, 'g')
const TILDETRIM_G = new RegExp(TILDETRIM.source, 'g')
const CARETTRIM_G = new RegExp(CARETTRIM.source, 'g')

const LOOKUP = {
  ANY: {
    '': true,
    '*': true,
    '>=0.0.0': true
  },
  NULLSET: {
    '<0.0.0-0': true
  }
}

const isX = (id) => !id || id.toLowerCase() === 'x' || id === '*'

// A build channel on a `~`/`^`/hyphen range applies to every comparator it
// desugars into, so `^1.0.0+win` becomes `>=1.0.0+win <2.0.0-0+win`.
const appendChannel = (desugared, build) =>
  build
    ? desugared.trim().split(/\s+/).filter(Boolean).map((tok) => `${tok}+${build}`).join(' ')
    : desugared

// ~ — allow patch-level changes when a minor is given, minor-level otherwise.
// ~> — the pessimistic operator with its RubyGems meaning: drop the last
// supplied part and allow up to the next value of the part before it. With one
// or three parts that equals the tilde; with two parts (`~>1.2`) it reaches the
// next major where the tilde stops at the next minor. A trailing x is not a
// supplied part, so `~>1.2.x` is `~>1.2`.
const replaceTildes = (comp) =>
  comp.trim().split(/\s+/).map((c) => replaceTilde(c)).join(' ')

const replaceTilde = (comp) =>
  comp.replace(TILDE, (_, op, M, m, p, pr, build) =>
    appendChannel(tildeDesugar(M, m, p, pr, op === '~>'), build))

const tildeDesugar = (M, m, p, pr, approximate) => {
  if (isX(M)) return ''
  if (isX(m)) return `>=${M}.0.0 <${+M + 1}.0.0-0`
  if (isX(p)) {
    return approximate
      ? `>=${M}.${m}.0 <${+M + 1}.0.0-0`
      : `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`
  }
  if (pr) return `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`
  return `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`
}

// ^ — allow changes that do not modify the left-most non-zero element.
const replaceCarets = (comp) =>
  comp.trim().split(/\s+/).map((c) => replaceCaret(c)).join(' ')

const replaceCaret = (comp) => {
  return comp.replace(CARET, (_, M, m, p, pr, build) =>
    appendChannel(caretDesugar(M, m, p, pr, ''), build))
}

const caretDesugar = (M, m, p, pr, z) => {
  if (isX(M)) return ''
  if (isX(m)) return `>=${M}.0.0${z} <${+M + 1}.0.0-0`
  if (isX(p)) {
    return M === '0'
      ? `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`
      : `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`
  }
  if (pr) {
    if (M === '0') {
      return m === '0'
        ? `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`
        : `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`
    }
    return `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`
  }
  if (M === '0') {
    return m === '0'
      ? `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`
      : `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`
  }
  return `>=${M}.${m}.${p} <${+M + 1}.0.0-0`
}

// X-Ranges — `1.2.x`, `1.X`, `1.2.*`, `*`, and bare partials.
const replaceXRanges = (comp) =>
  comp.split(/\s+/).map((c) => replaceXRange(c)).join(' ')

const replaceXRange = (comp) => {
  comp = comp.trim()
  return comp.replace(XRANGE, (ret, gtlt, M, m, p) => {
    const xM = isX(M)
    const xm = xM || isX(m)
    const xp = xm || isX(p)
    const anyX = xp
    let pr = ''

    if (gtlt === '=' && anyX) {
      gtlt = ''
    }

    if (xM) {
      return gtlt === '>' || gtlt === '<' ? '<0.0.0-0' : '*'
    }

    if (gtlt && anyX) {
      if (xm) m = 0
      p = 0
      if (gtlt === '>') {
        gtlt = '>='
        if (xm) {
          M = +M + 1
          m = 0
          p = 0
        } else {
          m = +m + 1
          p = 0
        }
      } else if (gtlt === '<=') {
        gtlt = '<'
        if (xm) M = +M + 1
        else m = +m + 1
      }
      if (gtlt === '<') pr = '-0'
      return `${gtlt}${M}.${m}.${p}${pr}`
    }

    if (xm) return `>=${M}.0.0${pr} <${+M + 1}.0.0-0`
    if (xp) return `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`
    return ret
  })
}

// `*` and `>= 0.0.0`-style wildcards collapse to "any".
const replaceStars = (comp) => comp.trim().replace(WILDCARD, '')

const replaceGTE0 = (comp) => comp.trim().replace(GTE0, '')

// `1.2.3 - 2.3.4` => `>=1.2.3 <=2.3.4` (with partial-version handling).
const hyphenReplace = (
  $0,
  from, fM, fm, fp, fpr, fb,
  to, tM, tm, tp, tpr, tb
) => {
  // Each endpoint keeps its own labels: a pre-release sets the numeric bound
  // and declares that endpoint's pre-release channel, and a build declares that
  // endpoint's build channel (see `testSet`), exactly as on a comparator.
  // Endpoints are reconstructed from parts so a partial endpoint (`1.2`) gets
  // its zeroes and its exclusive ceiling.
  if (isX(fM)) from = ''
  else if (isX(fm)) from = `>=${fM}.0.0`
  else if (isX(fp)) from = `>=${fM}.${fm}.0`
  else if (fpr) from = `>=${fM}.${fm}.${fp}-${fpr}`
  else from = `>=${fM}.${fm}.${fp}`
  if (from && fb) from += `+${fb}`

  if (isX(tM)) to = ''
  else if (isX(tm)) to = `<${+tM + 1}.0.0-0`
  else if (isX(tp)) to = `<${tM}.${+tm + 1}.0-0`
  else if (tpr) to = `<=${tM}.${tm}.${tp}-${tpr}`
  else to = `<=${tM}.${tm}.${tp}`
  if (to && tb) to += `+${tb}`

  return `${from} ${to}`.trim()
}

const parseComparator = (comp) => {
  if (comp.indexOf('^') !== -1) comp = replaceCarets(comp)
  if (comp.indexOf('~') !== -1) comp = replaceTildes(comp)
  comp = replaceXRanges(comp)
  if (comp.indexOf('*') !== -1) comp = replaceStars(comp)
  return comp
}

// Pre-release wildcards are a range-only opt-in to pre-releases, handled before
// desugaring so `*` never reaches a Version. Returns the rewritten set string
// plus the channel metadata (`universalPre`, `anyPreTuples`) to attach to the
// resulting comparator set. `*-*` becomes an all-versions lower bound flagged
// universal; `X.Y.Z-*` (optionally after `^`/`~`) becomes a numeric `-0` bound
// whose tuple is recorded as an empty-prefix ("any pre-release") channel.
const NO_PRE_WILDCARDS = { universalPre: false, anyPreTuples: new Set() }
const extractPreWildcards = (range) => {
  if (range.indexOf('*') === -1) {
    return { range, ...NO_PRE_WILDCARDS, anyPreTuples: new Set() }
  }
  let universalPre = false
  const anyPreTuples = new Set()
  const rewritten = range
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      if (STARPRE.test(tok)) {
        universalPre = true
        return '>=0.0.0-0'
      }
      const m = tok.match(TUPLEPRE)
      if (m) {
        const [, op = '', M, mm, pp] = m
        anyPreTuples.add(`${+M}.${+mm}.${+pp}`)
        return `${op}${M}.${mm}.${pp}-0`
      }
      return tok
    })
    .join(' ')
  return { range: rewritten, universalPre, anyPreTuples }
}

// True when `prefix` is a prefix of `ids` (identifier-wise), so `[rc]` matches
// `[rc]`, `[rc, 1]`, … but not `[beta]`. An empty prefix matches any pre-release.
const isPrefix = (prefix, ids) => {
  if (prefix.length > ids.length) {
    return false
  }
  for (let i = 0; i < prefix.length; i++) {
    if (String(prefix[i]) !== String(ids[i])) {
      return false
    }
  }
  return true
}

// Record wildcard-derived pre-release channels on a comparator set (a plain
// array). Named channels ride on the comparators themselves (their `preChannel`
// prefix + tuple); these two cover the wildcard forms that have no comparator to
// hang off: `*-*` (universal) and `X.Y.Z-*` (empty prefix for a tuple).
const attachPreChannels = (set, universalPre, anyPreTuples) => {
  set.universalPre = universalPre
  set.anyPreTuples = anyPreTuples
  return set
}

class Range {
  constructor (range, options = {}) {
    if (range instanceof Range) {
      return range
    }

    if (range instanceof Comparator) {
      range = range.value
    }

    if (typeof range !== 'string') {
      throw new TypeError(`Invalid Version Range: ${range}`)
    }

    const useCache = Object.keys(options).length === 0
    if (useCache) {
      const hit = cached(range)
      if (hit) {
        return hit
      }
    }

    if (range.length > MAX_LENGTH) {
      throw new TypeError(`Range exceeds ${MAX_LENGTH} characters: ${range.length}`)
    }

    this.options = options
    this.raw = range

    // A range may be scoped to a context (`npm:react@^1.2.3`). The context is
    // parsed off the front and matched separately in `test`; the comparator
    // body (`^1.2.3`) desugars exactly as an unqualified range would, so
    // `range`/precedence stay on the bare version-space.
    const { context, rest } = splitReference(range)
    this.context = context
    range = rest

    // Split on `||`, parse each comparator set, drop empty sets.
    this.set = range
      .split('||')
      .map((r) => this.parseRange(r.trim()))
      .filter((c) => c.length)

    if (!this.set.length) {
      throw new TypeError(`Invalid Version Range: ${range}`)
    }

    // If we have multiple sets, prune null sets and collapse to `*` if any
    // set is the "any" set.
    if (this.set.length > 1) {
      const first = this.set[0]
      this.set = this.set.filter((c) => !LOOKUP.NULLSET[c[0].value])
      if (this.set.length === 0) {
        this.set = [first]
      } else if (this.set.length > 1) {
        for (const c of this.set) {
          if (c.length === 1 && LOOKUP.ANY[c[0].value]) {
            this.set = [c]
            break
          }
        }
      }
    }

    this.format()
    if (useCache) {
      remember(this.raw, this)
    }
  }

  format () {
    this.range = this.set
      .map((comps) => comps.join(' ').trim())
      .join('||')
      .trim()
    return this.range
  }

  toString () {
    return this.range
  }

  parseRange (range) {
    range = range.trim()

    // Pull out any pre-release wildcards first, capturing channel metadata and
    // rewriting `*` to numeric bounds so the rest of desugaring is wildcard-free.
    const { range: rewritten, universalPre, anyPreTuples } = extractPreWildcards(range)
    range = rewritten

    // Desugar the advanced grammars into primitive comparators. The hyphen form
    // and the operator/whitespace normalisation only apply when the set has
    // whitespace in it, which most real ranges (`^1.2.3`) do not.
    if (/\s/.test(range)) {
      range = range.replace(HYPHENRANGE, hyphenReplace)
      range = range.replace(COMPARATORTRIM_G, '$1$2$3')
      range = range.replace(TILDETRIM_G, '$1$2')
      range = range.replace(CARETTRIM_G, '$1^')
      range = range.split(/\s+/).join(' ')
    }

    const rangeList = range
      .split(' ')
      .map((comp) => parseComparator(comp))
      .join(' ')
      .split(/\s+/)
      .map((comp) => replaceGTE0(comp))
      .filter((comp) => COMPARATOR.test(comp))
      .map((comp) => new Comparator(comp))

    // Deduplicate identical comparators by their normalized value.
    const map = new Map()
    for (const c of rangeList) {
      if (LOOKUP.NULLSET[c.value]) {
        const nullSet = [c]
        attachPreChannels(nullSet, universalPre, anyPreTuples)
        return nullSet
      }
      map.set(c.value, c)
    }

    // If more than one comparator, drop the redundant "any" ("") comparator.
    if (map.size > 1 && map.has('')) {
      map.delete('')
    }

    const set = [...map.values()]
    attachPreChannels(set, universalPre, anyPreTuples)
    return set
  }

  intersects (range) {
    if (!(range instanceof Range)) {
      throw new TypeError('a Range is required')
    }

    return this.set.some((thisComparators) => {
      return (
        isSatisfiable(thisComparators) &&
        range.set.some((rangeComparators) => {
          return (
            isSatisfiable(rangeComparators) &&
            thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator)
              })
            })
          )
        })
      )
    })
  }

  // If ANY of the comparator sets match ALL of its comparators, then pass.
  test (version) {
    if (!version) {
      return false
    }

    if (typeof version === 'string') {
      try {
        version = new Version(version)
      } catch (er) {
        return false
      }
    }

    // A context-scoped range forms a Contextual Set: it admits only versions
    // that share its context. A version of a different context (or none) is
    // outside the set, regardless of its numeric precedence. An unqualified
    // range (no context) stays context-agnostic and matches on version alone.
    if (this.context && version.context !== this.context) {
      return false
    }

    for (let i = 0; i < this.set.length; i++) {
      if (testSet(this.set[i], version)) {
        return true
      }
    }
    return false
  }
}

// Take a set of comparators and determine whether there
// exists a version which can satisfy it.
const isSatisfiable = (comparators) => {
  let result = true
  const remainingComparators = comparators.slice()
  let testComparator = remainingComparators.pop()

  while (result && remainingComparators.length) {
    result = remainingComparators.every((otherComparator) => {
      return testComparator.intersects(otherComparator)
    })

    testComparator = remainingComparators.pop()
  }

  return result
}

const testSet = (set, version) => {
  for (let i = 0; i < set.length; i++) {
    if (!set[i].test(version)) {
      return false
    }
  }

  // Stable versions are unaffected by pre-release channels: once inside the
  // numeric bounds they are always admitted.
  if (!version.prerelease.length) {
    return true
  }

  // A pre-release is admitted only when the range declares a channel that
  // covers it. This is the range-driven replacement for a global toggle:
  //   * `*-*` opts every tuple in (universal channel).
  //   * `X.Y.Z-*` opts one tuple in for any pre-release (empty-prefix channel).
  //   * a comparator carrying a pre-release (`^1.0.0-rc`, `>=1.2.3-beta`, a
  //     hyphen endpoint, …) opts its tuple in for pre-releases whose identifiers
  //     *begin with* that comparator's — a prefix channel. So `^1.0.0-rc` admits
  //     `rc`, `rc.1`, … but never `beta`, and never leaks into 1.5.0's tuple.
  if (set.universalPre) {
    return true
  }
  if (set.anyPreTuples && set.anyPreTuples.has(
    `${version.major}.${version.minor}.${version.patch}`)) {
    return true
  }
  for (let i = 0; i < set.length; i++) {
    const c = set[i]
    if (c.ANY || !c.isPre) {
      continue
    }
    const anchor = c.semver
    if (anchor.major === version.major &&
        anchor.minor === version.minor &&
        anchor.patch === version.patch &&
        isPrefix(c.preChannel, version.prerelease)) {
      return true
    }
  }
  return false
}

// Parse each candidate once and reuse it for both the range test and the
// comparison against the best match so far.
const pick = (versions, range, options, better) => {
  let best = null
  let bestSV = null
  let rangeObj = null
  try {
    rangeObj = new Range(range, options)
  } catch (er) {
    return null
  }
  for (const v of versions) {
    let sv
    try {
      sv = v instanceof Version ? v : new Version(v)
    } catch (er) {
      continue
    }
    if (rangeObj.test(sv) && (bestSV === null || better(sv.compare(bestSV)))) {
      best = v
      bestSV = sv
    }
  }
  return best
}

const maxSatisfying = (versions, range, options) => pick(versions, range, options, (c) => c > 0)

const minSatisfying = (versions, range, options) => pick(versions, range, options, (c) => c < 0)

export {
  Range,
  maxSatisfying,
  minSatisfying
}
