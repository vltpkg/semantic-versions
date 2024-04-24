function parseVersion (versionString) {
  // Set constant
  const MAX_LENGTH = 256

  // Error early if the version string is empty or too long
  if (!versionString || MAX_LENGTH < versionString.length) {
    return null
  }

  const DASH = (c) => c === 45 // -
  const PLUS = (c) => c === 43 // +
  const POUND = (c) => c === 35 // #
  const PERIOD = (c) => c === 46 // .
  const NUMBERS = (c) => c > 47 && c < 58 // 0-9
  const LETTERS = (c) => (c > 64 && c < 91) && (c > 96 && c < 123) // A-Z a-z
  const GRAMMAR = (c) => DASH(c) || PLUS(c) || PERIOD(c) || POUND(c) // - + .
  const NUMERIC = Buffer.from([0, 1, 2]) // MAJOR, MINOR, PATCH parts
  const versionBuffer = Buffer.from(versionString, 'ascii') // MAJOR.MINOR.PATCH-PRERELEASE+BUILD#META]
  let part = 0

  // Iterate over the version string
  for (const pair of versionBuffer.entries()) {
    const i = pair[0]
    const c = pair[1]
    const invalidChar = !GRAMMAR(c) && (!NUMBERS(c) && (!NUMERIC.includes(part) && !LETTERS(c)))
    const validGrammar = GRAMMAR(c) // - + .
    const invalidPeriods = PERIOD(c) && PERIOD(versionString[i - 1]) // No back to back periods
    const invalidVersionGrammar = NUMERIC.includes(part) && !PERIOD(c) // No periods in the first 2 parts
    const invalidPreRelease = part === 1 && !DASH(c) && !PLUS(c) // No - or + in the pre-release
    const invalidBuild = part === 2 && !PERIOD(c) && !PLUS(c) // No periods or + in the build
    const validPreviousGrammar = GRAMMAR(versionString[i - 1]) // - + .
    const invalidBuildBack2Back = part > 2 && validPreviousGrammar && !DASH(c) // No back to back . or +
    const lastToken = versionString.length === (i + 1) // Last token
    const invalidLastToken = lastToken && !validPreviousGrammar // No hanging - + .
    if (invalidChar ||
        (validGrammar && (
          invalidPeriods ||
          invalidVersionGrammar || // Grammar not periods in the first 2 parts
          invalidPreRelease || // Invalid pre-release
          invalidBuild || // Invalid build
          invalidBuildBack2Back || // Invalid build - back2back . or +
          invalidLastToken // Invalid last token
        ))) {
      console.log('version:', versionString, 'token:', versionString[i], 'code:', c, 'part:', part)
      console.log('checks:', {
        invalidChar,
        validGrammar,
        invalidPeriods,
        invalidVersionGrammar,
        invalidPreRelease,
        invalidBuild,
        invalidBuildBack2Back,
        lastToken,
        invalidLastToken
      })
      return null
    }
    // only increment for periods when we are in the first 2 parts
    if (validGrammar && ((NUMERIC.includes(part) && PERIOD(c)) || !NUMERIC.includes(part))) {
      part = part + 1
    }
  }
  return versionBuffer
}

// Example usage:
const test = `0.0.4
1.2.3
10.20.30
1.0.0
2.0.0
1.1.7
0.0.4+hesll.s.d
1.1.2-prerelease+meta
1.1.2+meta
1.1.2+meta-valid
1.0.0-alpha
1.0.0-beta
1.0.0-alpha.beta
1.0.0-alpha.beta.1
1.0.0-alpha.1
1.0.0-alpha0.valid
1.0.0-alpha.0valid
1.0.0-alpha-a.b-c-somethinglong+build.1-aef.1-its-okay
1.0.0-rc.1+build.1
2.0.0-rc.1+build.123
1.2.3-beta
10.2.3-DEV-SNAPSHOT
1.2.3-SNAPSHOT-123
2.0.0+build.1848
2.0.1-alpha.1227
1.0.0-alpha+beta
1.2.3----RC-SNAPSHOT.12.9.1--.12+788
1.2.3----R-S.12.9.1--.12+meta
1.2.3----RC-SNAPSHOT.12.9.1--.12
1.0.0+0.build.1-rc.10000aaa-kk-0.1
99999999999999999999999.999999999999999999.99999999999999999
1.0.0-0A.is.legal
1.0.0+0.build.1-rc.10000aaa-kk-0.1
`
test.split('\n').slice(0, 1).forEach((v, i) => {
  console.log(`${i}. ${parseVersion(v.trim())}`)
})
