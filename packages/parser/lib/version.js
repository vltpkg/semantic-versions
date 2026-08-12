import { FULL, NUMERIC, MAX_LENGTH, MAX_SAFE_INTEGER, LETTERDASHNUMBER } from './regex.js'

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

const parseVersion = (version) => {
  validVersion(version)
  const parts = version.trim().match(FULL)
  if (!parts) {
    throw new TypeError(`Invalid Version: ${version}`)
  }
  return parts
}

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

const parsePrerelease = (prerelease) => {
  const parse = (id) => {
    if (NUMERIC.test(id)) {
      if (id.length > 1 && id[0] === '0') {
        throw new TypeError('Invalid pre-release version: Numbers MUST NOT begin with a leading zero')
      }
      const num = +id
      if (num >= 0 && num < MAX_SAFE_INTEGER) {
        return num
      } else {
        throw new TypeError('Invalid pre-release version: Numbers MUST be safe integers')
      }
    }
    return id
  }
  return prerelease ? prerelease.split('.').map(parse) : []
}

const parseBuild = (build) => {
  if (!build) {
    return []
  }
  if (typeof build !== 'string') {
    throw new TypeError(`Invalid build version: ${build}`)
  }
  const parse = (id) => {
    if (LETTERDASHNUMBER.test(id)) {
      return id
    } else {
      throw new TypeError(`Invalid build version: ${build}`)
    }
  }
  return build.split('.').map(parse)
}

const compareIdentifiers = (a, b) => {
  const one = NUMERIC.test(a)
  const two = NUMERIC.test(b)
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
      return compareIdentifiers(a, b)
    }
  } while (++i)
}

export class Version {
  constructor (version) {
    if (version instanceof Version) {
      return version
    }
    // Split off an optional context (`npm:react@1.2.3`) before parsing the
    // version core. Context is identity, not ordering: it never participates in
    // precedence, so `version`/`raw` and every comparison stay on the bare core.
    const { context, rest } = splitReference(version)
    this.context = context
    const parts = parseVersion(rest)
    this.major = validMajor(+parts[1])
    this.minor = validMinor(+parts[2])
    this.patch = validPatch(+parts[3])
    this.prerelease = parsePrerelease(parts[4])
    this.build = parseBuild(parts[5])
    return this.format()
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
      compareIdentifiers(this.major, other.major) ||
      compareIdentifiers(this.minor, other.minor) ||
      compareIdentifiers(this.patch, other.patch) ||
      compareParts(this.prerelease, other.prerelease) ||
      compareBuild(this.build, other.build)
    )
  }

  #setPrerelease = (identifier, base) => {
    const change = Number(base) ? 1 : 0
    if (!identifier && base === false) {
      throw new TypeError('Invalid increment argument: Identifier is empty.')
    }
    if (this.prerelease.length === 0) {
      this.prerelease = [change]
    } else {
      let i = this.prerelease.length
      while (--i >= 0) {
        if (typeof this.prerelease[i] === 'number') {
          this.prerelease[i]++
          i = -2
        }
      }
      if (i === -1) {
        if (identifier === this.prerelease.join('.') && base === false) {
          throw new TypeError('Invalid increment argument: Identifier already exists.')
        }
        this.prerelease.push(change)
      }
    }
    if (identifier) {
      let prerelease = [identifier, change]
      if (base === false) {
        prerelease = [identifier]
      }
      if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
        if (isNaN(this.prerelease[1])) {
          this.prerelease = prerelease
        }
      } else {
        this.prerelease = prerelease
      }
    }
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
    this.#setPrerelease(identifier, base)
  }

  incrementPreminor (identifier, base) {
    this.prerelease.length = 0
    this.patch = 0
    this.minor++
    this.#setPrerelease(identifier, base)
  }

  incrementPrepatch (identifier, base) {
    this.prerelease.length = 0
    this.increment('patch', identifier, base)
    this.#setPrerelease(identifier, base)
  }

  incrementPrerelease (identifier, base) {
    if (this.prerelease.length === 0) {
      this.increment('patch', identifier, base)
    }
    this.#setPrerelease(identifier, base)
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
