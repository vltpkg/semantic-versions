/* eslint-disable no-unreachable-loop */
import { COMPARATOR } from './regex.js'
import { Version } from './version.js'
import { Range } from './range.js'

// A copy of `version` with its build metadata removed, used so range
// comparisons operate on the numeric+pre-release core only.
const stripBuild = (version) => {
  if (!version.build || version.build.length === 0) {
    return version
  }
  let core = `${version.major}.${version.minor}.${version.patch}`
  if (version.prerelease.length) {
    core = `${core}-${version.prerelease.join('.')}`
  }
  return new Version(core)
}

// True when a version's build identifiers begin with the channel's, i.e. the
// version belongs to that build channel. `+win` selects `win`, `win.x64`, …
const inChannel = (build, channel) => {
  if (build.length < channel.length) {
    return false
  }
  for (let i = 0; i < channel.length; i++) {
    if (String(build[i]) !== String(channel[i])) {
      return false
    }
  }
  return true
}

class Comparator {
  constructor (value) {
    if (value instanceof Comparator) {
      value = value.value
    }
    value = value.trim().split(/\s+/).join(' ')
    this.parse(value)
    if (this.ANY) {
      this.value = ''
    } else {
      this.value = this.operator + this.semver.version
    }
  }

  parse (value) {
    const parts = value.match(COMPARATOR)
    if (!parts) {
      throw new TypeError(`Invalid comparator: ${value}`)
    }
    this.operator = parts[1] !== undefined ? parts[1] : ''
    if (this.operator === '=') {
      this.operator = ''
    }
    if (!parts[2]) {
      this.ANY = true
      this.channel = []
      this.isPre = false
      this.preChannel = null
    } else {
      this.semver = new Version(parts[2])
      // Build metadata on a comparator is a *channel* filter, orthogonal to the
      // numeric comparison: `>=1.0.0+win` means ">= 1.0.0 whose build starts
      // with `win`". `core` is the build-stripped version used for the numeric
      // comparison so that build never participates in the ordering here.
      this.channel = this.semver.build.slice()
      this.core = this.channel.length ? stripBuild(this.semver) : this.semver
      // A pre-release on a comparator declares a *pre-release channel*: a prefix
      // filter scoped to this comparator's tuple, symmetric with the build
      // channel above. `^1.0.0-rc` admits `rc`, `rc.1`, … on 1.0.0, never
      // `beta`. The prefix is the comparator's own pre-release identifiers.
      this.isPre = this.semver.prerelease.length > 0
      this.preChannel = this.isPre ? this.semver.prerelease.slice() : null
    }
  }

  toString () {
    return this.value
  }

  test (version) {
    if (this.ANY) {
      return true
    }
    if (typeof version === 'string') {
      try {
        version = new Version(version)
      } catch (er) {
        return false
      }
    }
    if (version.ANY) {
      return true
    }
    // Numeric comparison ignores build metadata on both sides.
    const core = version.build.length ? stripBuild(version) : version
    if (!cmp(core, this.operator, this.core)) {
      return false
    }
    // When a channel is declared, the version must carry a build in that
    // channel (its build identifiers must begin with the channel's).
    if (this.channel.length) {
      return inChannel(version.build, this.channel)
    }
    return true
  }

  intersects (comp) {
    if (!(comp instanceof Comparator)) {
      throw new TypeError('a Comparator is required')
    }

    if (this.operator === '') {
      if (this.value === '') {
        return true
      }
      return new Range(comp.value).test(this.value)
    } else if (comp.operator === '') {
      if (comp.value === '') {
        return true
      }
      return new Range(this.value).test(comp.semver)
    }

    // Special cases where nothing can possibly be lower
    if (this.value === '<0.0.0-0' || comp.value === '<0.0.0-0') {
      return false
    }

    // Same direction increasing (> or >=)
    if (this.operator.startsWith('>') && comp.operator.startsWith('>')) {
      return true
    }
    // Same direction decreasing (< or <=)
    if (this.operator.startsWith('<') && comp.operator.startsWith('<')) {
      return true
    }
    // same SemVer and both sides are inclusive (<= or >=)
    if (
      (this.semver.version === comp.semver.version) &&
      this.operator.includes('=') && comp.operator.includes('=')) {
      return true
    }
    // opposite directions less than
    if (cmp(this.semver, '<', comp.semver) &&
      this.operator.startsWith('>') && comp.operator.startsWith('<')) {
      return true
    }
    // opposite directions greater than
    if (cmp(this.semver, '>', comp.semver) &&
      this.operator.startsWith('<') && comp.operator.startsWith('>')) {
      return true
    }
    return false
  }
}

const unstable = (range) => {
  const parsed = range = new Range(range)
  const stable = [
    ...parsed.major,
    ...parsed.minor,
    ...parsed.patch
  ]
  return (parsed && stable.length) ? stable : null
}

const stable = (range) => {
  const parsed = range = new Range(range)
  const stable = [
    ...parsed.major,
    ...parsed.minor,
    ...parsed.patch
  ]
  return (parsed && stable.length) ? stable : null
}

const compare = (a, b) =>
  new Version(a).compare(new Version(b))

const outside = (version, range, hilo) => {
  version = new Version(version)
  range = new Range(range)

  let gtfn, ltefn, ltfn, comp, ecomp
  switch (hilo) {
    case '>':
      gtfn = gt
      ltefn = lte
      ltfn = lt
      comp = '>'
      ecomp = '>='
      break
    case '<':
      gtfn = lt
      ltefn = gte
      ltfn = gt
      comp = '<'
      ecomp = '<='
      break
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"')
  }

  // If it satisfies the range it is not outside
  if (satisfies(version, range)) {
    return false
  }

  // From now on, variable terms are as if we're in "gtr" mode.
  // but note that everything is flipped for the "ltr" function.

  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i]

    let high = null
    let low = null

    comparators.forEach((comparator) => {
      if (comparator.ANY) {
        comparator = new Comparator('>=0.0.0')
      }
      high = high || comparator
      low = low || comparator
      if (gtfn(comparator.semver, high.semver)) {
        high = comparator
      } else if (ltfn(comparator.semver, low.semver)) {
        low = comparator
      }
    })

    // If the edge version comparator has a operator then our version
    // isn't outside it
    if (high.operator === comp || high.operator === ecomp) {
      return false
    }

    // If the lowest version comparator has an operator and our version
    // is less than it then it isn't higher than the range
    if ((!low.operator || low.operator === comp) &&
        ltefn(version, low.semver)) {
      return false
    } else if (low.operator === ecomp && ltfn(version, low.semver)) {
      return false
    }
  }
  return true
}
const eq = (a, b) => compare(a, b) === 0
const gt = (a, b) => compare(a, b) > 0
const gte = (a, b) => compare(a, b) >= 0
const gtr = (version, range) => outside(version, range, '>')
const lt = (a, b) => compare(a, b) < 0
const lte = (a, b) => compare(a, b) <= 0
const ltr = (version, range) => outside(version, range, '<')
const neq = (a, b) => compare(a, b) !== 0
const cmp = (a, op, b) => {
  switch (op) {
    case '===':
      if (typeof a === 'object') {
        a = a.version
      }
      if (typeof b === 'object') {
        b = b.version
      }
      return a === b
    case '!==':
      if (typeof a === 'object') {
        a = a.version
      }
      if (typeof b === 'object') {
        b = b.version
      }
      return a !== b
    case '':
    case '=':
    case '==':
      return eq(a, b)
    case '!=':
      return neq(a, b)
    case '>':
      return gt(a, b)
    case '>=':
      return gte(a, b)
    case '<':
      return lt(a, b)
    case '<=':
      return lte(a, b)
    default:
      throw new TypeError(`Invalid operator: ${op}`)
  }
}
const sort = (list) => list.sort((a, b) => compare(a, b))
const rsort = (list) => list.sort((a, b) => compare(b, a))
const satisfies = (version, range) => {
  if (version === range) {
    return true
  }
  try {
    range = new Range(range)
  } catch (er) {
    return false
  }
  return range.test(version)
}
const increment = (version, release, identifier, identifierBase) => {
  try {
    return new Version(version instanceof Version ? version.version : version).increment(release, identifier, identifierBase).version
  } catch (er) {
    return null
  }
}
const intersects = (r1, r2) => {
  r1 = new Range(r1)
  r2 = new Range(r2)
  return r1.intersects(r2)
}
const highest = (versions, range) => {
  let max = null
  let maxSV = null
  let rangeObj = null
  // sort descending
  versions = rsort(versions)
  try {
    rangeObj = new Range(range)
  } catch (er) {
    return null
  }
  versions.forEach((v) => {
    if (rangeObj.test(v)) {
      // satisfies(v, range)
      if (!max || maxSV.compare(v) === -1) {
        // compare(max, v, true)
        max = v
        maxSV = new Version(max)
      }
    }
  })
  return max
}
const lowest = (versions, range) => {
  let min = null
  let minSV = null
  let rangeObj = null
  // sort ascending
  versions = sort(versions)
  try {
    rangeObj = new Range(range)
  } catch (er) {
    return null
  }
  versions.forEach((v) => {
    if (rangeObj.test(v)) {
      // satisfies(v, range)
      if (!min || minSV.compare(v) === 1) {
        // compare(min, v, true)
        min = v
        minSV = new Version(min)
      }
    }
  })
  return min
}
const minimum = (range) => {
  range = new Range(range)

  let minver = new Version('0.0.0')
  if (range.test(minver)) {
    return minver
  }

  minver = new Version('0.0.0-0')
  if (range.test(minver)) {
    return minver
  }

  minver = null
  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i]

    let setMin = null
    comparators.forEach((comparator) => {
      // Clone to avoid manipulating the comparator's version object.
      const compver = new Version(comparator.semver.version)
      switch (comparator.operator) {
        case '>':
          if (compver.prerelease.length === 0) {
            compver.patch++
          } else {
            compver.prerelease.push(0)
          }
          compver.raw = compver.format()
          /* fallthrough */
        case '':
        case '>=':
          if (!setMin || gt(compver, setMin)) {
            setMin = compver
          }
          break
        case '<':
        case '<=':
          /* Ignore maximum versions */
          break
        /* istanbul ignore next */
        default:
          throw new Error(`Unexpected operation: ${comparator.operator}`)
      }
    })
    if (setMin && (!minver || gt(minver, setMin))) {
      minver = setMin
    }
  }

  if (minver && range.test(minver)) {
    return minver
  }

  return null
}

const subset = (sub, dom) => {
  if (sub === dom) {
    return true
  }

  sub = new Range(sub)
  dom = new Range(dom)
  let sawNonNull = false

  for (const simpleSub of sub.set) {
    for (const simpleDom of dom.set) {
      const isSub = simpleSubset(simpleSub, simpleDom)
      sawNonNull = sawNonNull || isSub !== null
      if (isSub) {
        continue
      }
    }
    if (sawNonNull) {
      return false
    }
  }
  return true
}

const minimumVersionWithPreRelease = [new Comparator('>=0.0.0-0')]
// const minimumVersion = [new Comparator('>=0.0.0')]

const simpleSubset = (sub, dom) => {
  if (sub === dom) {
    return true
  }

  if (sub.length === 1 && sub[0].ANY) {
    if (dom.length === 1 && dom[0].ANY) {
      return true
    } else {
      sub = minimumVersionWithPreRelease
    }
  }

  if (dom.length === 1 && dom[0].ANY) {
    return true
  }

  const eqSet = new Set()
  let gt, lt
  for (const c of sub) {
    if (c.operator === '>' || c.operator === '>=') {
      gt = higherGT(gt, c)
    } else if (c.operator === '<' || c.operator === '<=') {
      lt = lowerLT(lt, c)
    } else {
      eqSet.add(c.semver)
    }
  }

  if (eqSet.size > 1) {
    return null
  }

  let gtltComp
  if (gt && lt) {
    gtltComp = compare(gt.semver, lt.semver)
    if (gtltComp > 0) {
      return null
    } else if (gtltComp === 0 && (gt.operator !== '>=' || lt.operator !== '<=')) {
      return null
    }
  }

  // will iterate one or zero times
  for (const eq of eqSet) {
    if (gt && !satisfies(eq, String(gt))) {
      return null
    }

    if (lt && !satisfies(eq, String(lt))) {
      return null
    }

    for (const c of dom) {
      if (!satisfies(eq, String(c))) {
        return false
      }
    }

    return true
  }

  let higher, lower
  let hasDomLT, hasDomGT
  // if the subset has a prerelease, we need a comparator in the superset
  // with the same tuple and a prerelease, or it's not a subset
  let needDomLTPre = lt && lt.semver.prerelease.length ? lt.semver : false
  let needDomGTPre = gt && gt.semver.prerelease.length ? gt.semver : false
  // exception: <1.2.3-0 is the same as <1.2.3
  if (needDomLTPre && needDomLTPre.prerelease.length === 1 &&
      lt.operator === '<' && needDomLTPre.prerelease[0] === 0) {
    needDomLTPre = false
  }

  for (const c of dom) {
    hasDomGT = hasDomGT || c.operator === '>' || c.operator === '>='
    hasDomLT = hasDomLT || c.operator === '<' || c.operator === '<='
    if (gt) {
      if (needDomGTPre) {
        if (c.semver.prerelease && c.semver.prerelease.length &&
            c.semver.major === needDomGTPre.major &&
            c.semver.minor === needDomGTPre.minor &&
            c.semver.patch === needDomGTPre.patch) {
          needDomGTPre = false
        }
      }
      if (c.operator === '>' || c.operator === '>=') {
        higher = higherGT(gt, c)
        if (higher === c && higher !== gt) {
          return false
        }
      } else if (gt.operator === '>=' && !satisfies(gt.semver, String(c))) {
        return false
      }
    }
    if (lt) {
      if (needDomLTPre) {
        if (c.semver.prerelease && c.semver.prerelease.length &&
            c.semver.major === needDomLTPre.major &&
            c.semver.minor === needDomLTPre.minor &&
            c.semver.patch === needDomLTPre.patch) {
          needDomLTPre = false
        }
      }
      if (c.operator === '<' || c.operator === '<=') {
        lower = lowerLT(lt, c)
        if (lower === c && lower !== lt) {
          return false
        }
      } else if (lt.operator === '<=' && !satisfies(lt.semver, String(c))) {
        return false
      }
    }
    if (!c.operator && (lt || gt) && gtltComp !== 0) {
      return false
    }
  }

  // if there was a < or >, and nothing in the dom, then must be false
  // UNLESS it was limited by another range in the other direction.
  // Eg, >1.0.0 <1.0.1 is still a subset of <2.0.0
  if (gt && hasDomLT && !lt && gtltComp !== 0) {
    return false
  }

  if (lt && hasDomGT && !gt && gtltComp !== 0) {
    return false
  }

  // we needed a prerelease range in a specific tuple, but didn't get one
  // then this isn't a subset.  eg >=1.2.3-pre is not a subset of >=1.0.0,
  // because it includes prereleases in the 1.2.3 tuple
  if (needDomGTPre || needDomLTPre) {
    return false
  }

  return true
}

// >=1.2.3 is lower than >1.2.3
const higherGT = (a, b) => {
  if (!a) {
    return b
  }
  const comp = compare(a.semver, b.semver)
  return comp > 0 ? a : comp < 0 ? b : b.operator === '>' && a.operator === '>=' ? b : a
}

// <=1.2.3 is higher than <1.2.3
const lowerLT = (a, b) => {
  if (!a) {
    return b
  }
  const comp = compare(a.semver, b.semver)
  return comp < 0 ? a : comp > 0 ? b : b.operator === '<' && a.operator === '<=' ? b : a
}

export {
  Comparator,
  compare,
  subset,
  minimum,
  lowest,
  highest,
  intersects,
  increment,
  satisfies,
  rsort,
  sort,
  cmp,
  outside,
  eq,
  neq,
  lt,
  lte,
  ltr,
  gt,
  gte,
  gtr,
  stable,
  unstable
}
