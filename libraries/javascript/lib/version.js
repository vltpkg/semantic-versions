import { NUMERIC, MAX_LENGTH, MAX_SAFE_INTEGER } from './regex.js'

// A *reference* is an optional context and an `@`-separated version (or, for a
// Range, a range body): `context@1.2.3`. The context is the identity a version
// belongs to (a package, module, image, crate, service, …), optionally
// source-qualified as `source:name` (`npm:react`, `cargo:serde`). Neither a
// version core nor a range body ever contains an `@`, and an identity never
// contains whitespace, so the separator is the last `@` in the first
// whitespace-delimited chunk. A scoped npm name (`@scope/pkg`) keeps its
// leading `@` as part of the context.
export const splitReference = (str) => {
  if (typeof str !== 'string') {
    return { context: null, rest: str }
  }
  const firstSpace = str.search(/\s/)
  const head = firstSpace === -1 ? str : str.slice(0, firstSpace)
  const tail = firstSpace === -1 ? '' : str.slice(firstSpace)
  const at = head.lastIndexOf('@')
  if (at <= 0) {
    return { context: null, rest: str }
  }
  return { context: head.slice(0, at), rest: head.slice(at + 1) + tail }
}

// A single-pass scanner equivalent to the FULL grammar (see regex.js):
//   (0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)
//   (?:-(PRE(?:\.PRE)*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?
// where PRE is `0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*`. It builds the parsed
// parts as it goes, so nothing is re-split or re-joined afterwards.
const isDigit = (c) => c >= 48 && c <= 57
const isIdent = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45

const invalid = (version) => new TypeError(`Invalid Version: ${version}`)

const scan = (s, version) => {
  const len = s.length
  const nums = [0, 0, 0]
  let i = 0
  for (let n = 0; n < 3; n++) {
    if (n > 0) {
      if (s.charCodeAt(i) !== 46) throw invalid(version)
      i++
    }
    const start = i
    let value = 0
    let c
    while (i < len && isDigit(c = s.charCodeAt(i))) {
      value = value * 10 + (c - 48)
      i++
    }
    if (i === start || (i - start > 1 && s.charCodeAt(start) === 48)) throw invalid(version)
    nums[n] = value
  }
  const prerelease = []
  const build = []
  if (i < len && s.charCodeAt(i) === 45) {
    i = scanIdentifiers(s, i + 1, prerelease, true, version)
  }
  if (i < len && s.charCodeAt(i) === 43) {
    i = scanIdentifiers(s, i + 1, build, false, version)
  }
  if (i !== len) throw invalid(version)
  return { major: nums[0], minor: nums[1], patch: nums[2], prerelease, build }
}

// Dot-separated identifiers from `i` into `out`. Pre-release identifiers that
// are all digits must not have a leading zero and become numbers; build
// identifiers stay strings exactly as written.
const scanIdentifiers = (s, i, out, pre, version) => {
  const len = s.length
  for (;;) {
    const start = i
    let digits = true
    let c
    while (i < len && isIdent(c = s.charCodeAt(i))) {
      if (c < 48 || c > 57) digits = false
      i++
    }
    if (i === start) throw invalid(version)
    const id = s.slice(start, i)
    if (pre && digits) {
      if (i - start > 1 && s.charCodeAt(start) === 48) {
        throw new TypeError('Invalid pre-release version: Numbers MUST NOT begin with a leading zero')
      }
      const num = +id
      if (!(num >= 0 && num < MAX_SAFE_INTEGER)) {
        throw new TypeError('Invalid pre-release version: Numbers MUST be safe integers')
      }
      out.push(num)
    } else {
      out.push(id)
    }
    if (i < len && s.charCodeAt(i) === 46) {
      i++
      continue
    }
    return i
  }
}

const isSpace = (c) => c === 32 || (c >= 9 && c <= 13) || c === 160 || c === 65279

const validVersion = (version) => {
  if (version && typeof version !== 'string') {
    throw new TypeError(`Invalid Version: ${version}`)
  }
  if (version.length > MAX_LENGTH) {
    throw new TypeError(`Invalid Version: Version is longer than ${MAX_LENGTH} characters.`)
  }
}

const validMajor = (major) => {
  if (major > MAX_SAFE_INTEGER || major < 0) {
    throw new TypeError('Invalid major version.')
  }
  return major
}

const validMinor = (minor) => {
  if (minor > MAX_SAFE_INTEGER || minor < 0) {
    throw new TypeError('Invalid minor version.')
  }
  return minor
}

const validPatch = (patch) => {
  if (patch > MAX_SAFE_INTEGER || patch < 0) {
    throw new TypeError('Invalid patch version.')
  }
  return patch
}

// A cheap first-character check avoids running the numeric regex on
// alphanumeric identifiers.
const isNumeric = (id) => typeof id === 'number' || (id.charCodeAt(0) <= 57 && NUMERIC.test(id))

const compareNumbers = (a, b) => (a === b ? 0 : a < b ? -1 : 1)

const compareIdentifiers = (a, b) => {
  const one = isNumeric(a)
  const two = isNumeric(b)
  if (one && two) {
    a = +a
    b = +b
  }
  return a === b ? 0 : (one && !two) ? -1 : (two && !one) ? 1 : a < b ? -1 : 1
}

// Pre-release identifiers: a version WITH a pre-release has LOWER precedence
// than the same version without one (1.0.0-rc < 1.0.0).
const compareParts = (one, two) => {
  if (one.length && !two.length) {
    return -1
  } else if (!one.length && two.length) {
    return 1
  } else if (!one.length && !two.length) {
    return 0
  }
  return compareList(one, two)
}

// Build metadata participates in precedence as a *refinement*: a version that
// carries build metadata has HIGHER precedence than the same version without it
// (1.0.0 < 1.0.0+build), and builds order among themselves by identifier. This
// restores the build precedence SemVer 2.0.0 removed — but unlike a pre-release
// a build ranks *above* the plain release, because it names a more specific
// artifact of that release, not a step on the way to it.
const compareBuild = (one, two) => {
  if (one.length && !two.length) {
    return 1
  } else if (!one.length && two.length) {
    return -1
  } else if (!one.length && !two.length) {
    return 0
  }
  return compareList(one, two)
}

const compareList = (one, two) => {
  let i = 0
  do {
    const a = one[i]
    const b = two[i]
    if (a === undefined && b === undefined) {
      return 0
    } else if (b === undefined) {
      return 1
    } else if (a === undefined) {
      return -1
    } else if (a === b) {
      continue
    } else {
      // Identifiers can be equal without being identical (`001` and `1` in a
      // build), so keep going rather than stopping at the first tie.
      const c = compareIdentifiers(a, b)
      if (c) {
        return c
      }
    }
  } while (++i)
}

// Precedence ignoring builds on both sides: the numeric part of a range
// comparison, where a build is a channel filter rather than part of the bound.
export const compareWithoutBuild = (a, b) =>
  compareNumbers(a.major, b.major) ||
  compareNumbers(a.minor, b.minor) ||
  compareNumbers(a.patch, b.patch) ||
  compareParts(a.prerelease, b.prerelease)

export class Version {
  constructor (version) {
    if (version instanceof Version) {
      return version
    }
    // Split off an optional context (`npm:react@1.2.3`) before parsing the
    // version core. Context is identity, not ordering: it never participates in
    // precedence, so `version`/`raw` and every comparison stay on the bare core.
    let context = null
    let rest = version
    if (typeof version === 'string' && version.indexOf('@') !== -1) {
      ({ context, rest } = splitReference(version))
    }
    this.context = context
    validVersion(rest)
    // Only pay for trim() when there is surrounding whitespace.
    const str = rest.length && (isSpace(rest.charCodeAt(0)) || isSpace(rest.charCodeAt(rest.length - 1)))
      ? rest.trim()
      : rest
    const parts = scan(str, rest)
    this.major = validMajor(parts.major)
    this.minor = validMinor(parts.minor)
    this.patch = validPatch(parts.patch)
    this.prerelease = parts.prerelease
    this.build = parts.build
    // A string that scans is already in normal form, so it is the version.
    this.raw = this.version = str
    this.reference = context ? `${context}@${str}` : str
  }

  toString () {
    return this.version
  }

  format () {
    this.raw = this.version = `${this.major}.${this.minor}.${this.patch}`
    if (this.prerelease.length) {
      this.raw = this.version = `${this.version}-${this.prerelease.join('.')}`
    }
    if (this.build.length) {
      this.raw = this.version = `${this.version}+${this.build.join('.')}`
    }
    // The full identity-qualified form, when a context is present. `version`
    // and `raw` stay bare so precedence and existing round-trips are unchanged.
    this.reference = this.context ? `${this.context}@${this.version}` : this.version
    return this.version
  }

  compare (other) {
    if (!(other instanceof Version)) {
      other = new Version(other)
    }
    if (other.version === this.version) {
      return 0
    }
    return (
      compareNumbers(this.major, other.major) ||
      compareNumbers(this.minor, other.minor) ||
      compareNumbers(this.patch, other.patch) ||
      compareParts(this.prerelease, other.prerelease) ||
      compareBuild(this.build, other.build)
    )
  }

  incrementMajor () {
    if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
      this.major++
    }
    this.minor = 0
    this.patch = 0
    this.prerelease = []
  }

  incrementMinor () {
    if (this.patch !== 0 || this.prerelease.length === 0) {
      this.minor++
    }
    this.patch = 0
    this.prerelease = []
  }

  incrementPatch () {
    if (this.prerelease.length === 0) {
      this.patch++
    }
    this.prerelease = []
  }

  incrementPremajor (identifier, base) {
    this.prerelease.length = 0
    this.patch = 0
    this.minor = 0
    this.major++
    setPrerelease(this, identifier, base)
  }

  incrementPreminor (identifier, base) {
    this.prerelease.length = 0
    this.patch = 0
    this.minor++
    setPrerelease(this, identifier, base)
  }

  incrementPrepatch (identifier, base) {
    this.prerelease.length = 0
    this.increment('patch', identifier, base)
    setPrerelease(this, identifier, base)
  }

  incrementPrerelease (identifier, base) {
    if (this.prerelease.length === 0) {
      this.increment('patch', identifier, base)
    }
    setPrerelease(this, identifier, base)
  }

  inc (release, identifier, base) {
    return this.increment(release, identifier, base)
  }

  increment (release, identifier, base) {
    this.build = []
    switch (release) {
      case 'premajor':
        this.incrementPremajor(identifier, base)
        break
      case 'preminor':
        this.incrementPreminor(identifier, base)
        break
      case 'prepatch':
        this.incrementPrepatch(identifier, base)
        break
      case 'prerelease':
        this.incrementPrerelease(identifier, base)
        break
      case 'major':
        this.incrementMajor()
        break
      case 'minor':
        this.incrementMinor()
        break
      case 'patch':
        this.incrementPatch()
        break
      default:
        throw new TypeError(`Invalid release type: ${release}.`)
    }
    this.raw = this.format()
    return this
  }
}

// Shared by the pre-* increments. A module function rather than a method (or a
// private #method, which needs ES2022), so constructing a Version allocates no
// closure and the library runs on ES2020 engines.
function setPrerelease (version, identifier, base) {
  const change = Number(base) ? 1 : 0
  if (!identifier && base === false) {
    throw new TypeError('Invalid increment argument: Identifier is empty.')
  }
  if (version.prerelease.length === 0) {
    version.prerelease = [change]
  } else {
    let i = version.prerelease.length
    while (--i >= 0) {
      if (typeof version.prerelease[i] === 'number') {
        version.prerelease[i]++
        i = -2
      }
    }
    if (i === -1) {
      if (identifier === version.prerelease.join('.') && base === false) {
        throw new TypeError('Invalid increment argument: Identifier already exists.')
      }
      version.prerelease.push(change)
    }
  }
  if (identifier) {
    let prerelease = [identifier, change]
    if (base === false) {
      prerelease = [identifier]
    }
    if (compareIdentifiers(version.prerelease[0], identifier) === 0) {
      if (isNaN(version.prerelease[1])) {
        version.prerelease = prerelease
      }
    } else {
      version.prerelease = prerelease
    }
  }
}
