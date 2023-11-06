const MAX_LENGTH = 256
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991
const MAX_SAFE_COMPONENT_LENGTH = 16

const re = (expression) => new RegExp(expression)

const EX_NUMERIC = /^[0-9]+$/
const NUMERIC = re(EX_NUMERIC)

const EX_LETTERDASHNUMBER = '[a-zA-Z0-9-]'
const LETTERDASHNUMBER = re(EX_LETTERDASHNUMBER)

// ## Numeric Identifier
// A single `0`, or a non-zero digit followed by zero or more digits.
const EX_NUMERICIDENTIFIER = '0|[1-9]\\d*'
const NUMERICIDENTIFIER = re(EX_NUMERICIDENTIFIER)

// ## Non-numeric Identifier
// Zero or more digits, followed by a letter or hyphen, and then zero or
// more letters, digits, or hyphens.
const EX_NONNUMERICIDENTIFIER = `\\d*[a-zA-Z-]${EX_LETTERDASHNUMBER}*`
const NONNUMERICIDENTIFIER = re(EX_NONNUMERICIDENTIFIER)

// ## Main Version
// Three dot-separated numeric identifiers.
const EX_MAINVERSION = `(${EX_NUMERICIDENTIFIER})\\.(${EX_NUMERICIDENTIFIER})\\.(${EX_NUMERICIDENTIFIER})`
const MAINVERSION = re(EX_MAINVERSION)

// ## Pre-release Version Identifier
// A numeric identifier, or a non-numeric identifier.
const EX_PRERELEASEIDENTIFIER = `(?:${EX_NUMERICIDENTIFIER}|${EX_NONNUMERICIDENTIFIER})`
const PRERELEASEIDENTIFIER = re(EX_PRERELEASEIDENTIFIER)

// ## Pre-release Version
// Hyphen, followed by one or more dot-separated pre-release version
// identifiers.
const EX_PRERELEASE = `(?:-(${EX_PRERELEASEIDENTIFIER}(?:\\.${EX_PRERELEASEIDENTIFIER})*))`
const PRERELEASE = re(EX_PRERELEASE)

// ## Build Metadata Identifier
// Any combination of digits, letters, or hyphens.
const EX_BUILDIDENTIFIER = `${EX_LETTERDASHNUMBER}+`
const BUILDIDENTIFIER = re(EX_BUILDIDENTIFIER)

// ## Build Metadata
// Plus sign, followed by one or more period-separated build metadata
// identifiers.
const EX_BUILD = `(?:\\+(${EX_BUILDIDENTIFIER}(?:\\.${EX_BUILDIDENTIFIER})*))`
const BUILD = re(EX_BUILD)

// ## Full Version String
// A main version, followed optionally by a pre-release version and
// build metadata.

// Note that the only major, minor, patch, and pre-release sections of
// the version string are capturing groups.  The build metadata is not a
// capturing group, because it should not ever be used in version
// comparison.

const EX_FULLPLAIN = `v?${EX_MAINVERSION}${EX_PRERELEASE}?${EX_BUILD}?`
const FULLPLAIN = re(EX_FULLPLAIN)
const EX_FULL = `^${EX_FULLPLAIN}$`
const FULL = re(EX_FULL)
const EX_GTLT = '((?:<|>)?=?)'
const GTLT = re(EX_GTLT)

// Something like "2.*" or "1.2.x".
// Note that "x.x" is a valid xRange identifer, meaning "any version"
// Only the first item is strictly required.
const EX_XRANGEIDENTIFIER = `${EX_NUMERICIDENTIFIER}|x|X|\\*`
const XRANGEIDENTIFIER = re(EX_XRANGEIDENTIFIER)
const EX_XRANGEPLAIN = `[v=\\s]*(${EX_XRANGEIDENTIFIER})(?:\\.(${EX_XRANGEIDENTIFIER})(?:\\.(${EX_XRANGEIDENTIFIER})(?:${EX_PRERELEASE})?${EX_BUILD}?)?)?`
const XRANGEPLAIN = re(EX_XRANGEPLAIN)
const EX_XRANGE = `^${EX_GTLT}\\s*${EX_XRANGEPLAIN}$`
const XRANGE = re(EX_XRANGE)

// Tilde ranges.
// Meaning is "reasonably at or greater than"
const EX_LONETILDE = '(?:~>?)'
const LONETILDE = re(EX_LONETILDE)
const EX_TILDETRIM = `(\\s*)${EX_LONETILDE}\\s+`
const TILDETRIM = re(EX_TILDETRIM)
const EX_TILDE = `^${EX_LONETILDE}${EX_XRANGEPLAIN}$`
const TILDE = re(EX_TILDE)
const EX_TILDETRIMREPLACE = '$1~'
const TILDETRIMREPLACE = re(EX_TILDETRIMREPLACE)

// Caret ranges.
// Meaning is "at least and backwards compatible with"
const EX_LONECARET = '(?:\\^)'
const LONECARET = re(EX_LONECARET)
const EX_CARETTRIM = `(\\s*)${EX_LONECARET}\\s+`
const CARETTRIM = re(EX_CARETTRIM)
const EX_CARET = `^${EX_LONECARET}${EX_XRANGEPLAIN}$`
const CARET = re(EX_CARET)
const EX_CARETTRIMREPLACE = '$1^'
const CARETTRIMREPLACE = re(EX_CARETTRIMREPLACE)

// A simple gt/lt/eq thing, or just "" to indicate "any version"
const EX_COMPARATOR = `^${EX_GTLT}\\s*(${EX_FULLPLAIN})$|^$`
const COMPARATOR = re(EX_COMPARATOR)

// An expression to strip any whitespace between the gtlt and the thing
// it modifies, so that `> 1.2.3` ==> `>1.2.3`
const EX_COMPARATORTRIM = `(\\s*)${EX_GTLT}\\s*(${EX_LOOSEPLAIN}|${EX_XRANGEPLAIN})`
const COMPARATORTRIM = re(EX_COMPARATORTRIM)
const EX_COMPARATORTRIMREPLACE = '$1$2$3'
const COMPARATORTRIMREPLACE = re(EX_COMPARATORTRIMREPLACE)

// Something like `1.2.3 - 1.2.4`
// Note that these all use the loose form, because they'll be
// checked against either the strict or loose comparator form
// later.
const EX_HYPHENRANGE = `^\\s*(${EX_XRANGEPLAIN})\\s+-\\s+(${EX_XRANGEPLAIN})\\s*$`
const HYPHENRANGE = re(EX_HYPHENRANGE)

// Star ranges basically just allow anything at all.
const EX_STAR = '(<|>)?=?\\s*\\*'
const STAR = re(EX_STAR)

// >=0.0.0 is like a star
const EX_GTE0 = '^\\s*>=\\s*0\\.0\\.0\\s*$'
const GTE0 = re(EX_GTE0)
const EX_GTE0PRE = '^\\s*>=\\s*0\\.0\\.0-0\\s*$'
const GTE0PRE = re(EX_GTE0PRE)

export {
  re,
  MAX_LENGTH,
  MAX_SAFE_INTEGER,
  MAX_SAFE_COMPONENT_LENGTH,
  NUMERIC,
  LETTERDASHNUMBER,
  NUMERICIDENTIFIER,
  NONNUMERICIDENTIFIER,
  MAINVERSION,
  PRERELEASEIDENTIFIER,
  PRERELEASE,
  BUILDIDENTIFIER,
  BUILD,
  FULLPLAIN,
  FULL,
  GTLT,
  XRANGEIDENTIFIER,
  XRANGEPLAIN,
  XRANGE,
  LONETILDE,
  TILDETRIM,
  TILDETRIMREPLACE,
  TILDE,
  LONECARET,
  CARETTRIM,
  CARETTRIMREPLACE,
  CARET,
  COMPARATOR,
  COMPARATORTRIM,
  COMPARATORTRIMREPLACE,
  HYPHENRANGE,
  STAR,
  GTE0,
  GTE0PRE
}
