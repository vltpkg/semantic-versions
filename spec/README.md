# Semantic Versioning (Extended)

## Introduction

This specification extends the "Semantic Versioning 2.0.0" scheme and creates a new living document. This scheme documents version numbers, how changes to them convey meaning about the underlying code and what has been modified from one version to the next while also outlining grammars for iteration, comparison, matching, sets & expansion.

## Changes

Changes to this document will be collected & published on a yearly cadence. 

---

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://tools.ietf.org/html/rfc2119).

#### Versions

1. Software using Semantic Versioning (Extended) MUST declare a public API. This API could be declared in the code itself or exist strictly in documentation. However it is done, it SHOULD be precise and comprehensive.

1. A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes. X is the major version, Y is the minor version, and Z is the patch version. Each element MUST increase numerically. For instance: 1.9.0 -> 1.10.0 -> 1.11.0.

1. Once a versioned package has been released, the contents of that version MUST NOT be modified. Any modifications MUST be released as a new version.

1. Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The public API SHOULD NOT be considered stable.

1. Version 1.0.0 defines the public API. The way in which the version number is incremented after this release is dependent on this public API and how it changes.

1. Patch version Z (x.y.Z | x > 0) MUST be incremented if only backward compatible bug fixes are introduced. A bug fix is defined as an internal change that fixes incorrect behavior.

1. Minor version Y (x.Y.z | x > 0) MUST be incremented if new, backward compatible functionality is introduced to the public API. It MUST be incremented if any public API functionality is marked as deprecated. It MAY be incremented if substantial new functionality or improvements are introduced within the private code. It MAY include patch level changes. Patch version MUST be reset to 0 when minor version is incremented.

1. Major version X (X.y.z | X > 0) MUST be incremented if any backward incompatible changes are introduced to the public API. It MAY also include minor and patch level changes. Patch and minor versions MUST be reset to 0 when major version is incremented.

1. A pre-release version MUST be denoted by appending a hyphen and a series of dot separated identifiers immediately following the patch version. Identifiers MUST comprise only ASCII alphanumerics and hyphens [0-9A-Za-z-]. Identifiers MUST NOT be empty. Numeric identifiers MUST NOT include leading zeroes. Pre-release versions have a lower precedence than the associated normal version. A pre-release version indicates that the version is unstable and might not satisfy the intended compatibility requirements as denoted by its associated normal version. Examples: 1.0.0-alpha, 1.0.0-alpha.1, 1.0.0-0.3.7, 1.0.0-x.7.z.92, 1.0.0-x-y-z.\-\-.

1. A version with build metadata MUST be denoted by appending a plus sign and a series of dot separated identifiers immediately following the patch or pre-release version Identifiers MUST comprise only ASCII alphanumerics and hyphens [0-9A-Za-z-] Identifiers MUST NOT be empty. Build metadata MUST be ignored when determining version precedence. Thus two versions that differ only in the build metadata, have the same precedence. Examples: 1.0.0-alpha+001, 1.0.0+20130313144700, 1.0.0-beta+exp.sha.5114f85, 1.0.0+21AF26D3\-\-\-\-117B344092BD.

#### Iteration

Given a version number MAJOR.MINOR.PATCH, increment the:

1. MAJOR version when you make incompatible API changes
2. MINOR version when you add functionality in a backward compatible
   manner
3. PATCH version when you make backward compatible bug fixes

Additional labels for PRERELEASE and BUILDMETADATA are available as extensions
to the MAJOR.MINOR.PATCH format.

#### Ranges

##### Expansion

1. 

##### Wildcards

1. A wildcard version range **MUST** be a subset of a normal verision where the major, minor or patch versions are removed or replaced with a glob identifier of [xX*]. Examples: `1.x`, `1.x.x`, `1.2.x`, `*`, `3.X`

#### Comparators

##### Precedence (Ascending)

Precedence refers to how versions are compared to each other when ordered.

1. Precedence MUST be calculated by separating the version into major,
   minor, patch and pre-release identifiers in that order (Build metadata
   does not figure into precedence).

2. Precedence is determined by the first difference when comparing each of
   these identifiers from left to right as follows: Major, minor, and patch
   versions are always compared numerically.

   Example: 1.0.0 < 2.0.0 < 2.1.0 < 2.1.1.

3. When major, minor, and patch are equal, a pre-release version has lower
   precedence than a normal version:

   Example: 1.0.0-alpha < 1.0.0.

4. Precedence for two pre-release versions with the same major, minor, and
   patch version MUST be determined by comparing each dot separated identifier
   from left to right until a difference is found as follows:

   1. Identifiers consisting of only digits are compared numerically.

   2. Identifiers with letters or hyphens are compared lexically in ASCII
      sort order.

   3. Numeric identifiers always have lower precedence than non-numeric
      identifiers.

   4. A larger set of pre-release fields has a higher precedence than a
      smaller set, if all of the preceding identifiers are equal.

   Example: 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 
   1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0.

##### Greater than equal 


---

## FAQ

### Why Use Semantic Versioning (Extended)?

"Semantic Versioning 2.0.0" was written ~10 years ago & does not provide details about the more modern needs of versioning tools & maintainers to avoid dependency hell (ex. partials & ranges).


Backus–Naur Form Grammar for Valid SemVer Versions
--------------------------------------------------
```
<valid semver> ::= <version core>
                 | <version core> "-" <pre-release>
                 | <version core> "+" <build>
                 | <version core> "-" <pre-release> "+" <build>

<version core> ::= <major> "." <minor> "." <patch>

<major> ::= <numeric identifier>

<minor> ::= <numeric identifier>

<patch> ::= <numeric identifier>

<pre-release> ::= <dot-separated pre-release identifiers>

<dot-separated pre-release identifiers> ::= <pre-release identifier>
                                          | <pre-release identifier> "." <dot-separated pre-release identifiers>

<build> ::= <dot-separated build identifiers>

<dot-separated build identifiers> ::= <build identifier>
                                    | <build identifier> "." <dot-separated build identifiers>

<pre-release identifier> ::= <alphanumeric identifier>
                           | <numeric identifier>

<build identifier> ::= <alphanumeric identifier>
                     | <digits>

<alphanumeric identifier> ::= <non-digit>
                            | <non-digit> <identifier characters>
                            | <identifier characters> <non-digit>
                            | <identifier characters> <non-digit> <identifier characters>

<numeric identifier> ::= "0"
                       | <positive digit>
                       | <positive digit> <digits>

<identifier characters> ::= <identifier character>
                          | <identifier character> <identifier characters>

<identifier character> ::= <digit>
                         | <non-digit>

<non-digit> ::= <letter>
              | "-"

<digits> ::= <digit>
           | <digit> <digits>

<digit> ::= "0"
          | <positive digit>

<positive digit> ::= "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

<letter> ::= "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
           | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T"
           | "U" | "V" | "W" | "X" | "Y" | "Z" | "a" | "b" | "c" | "d"
           | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n"
           | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x"
           | "y" | "z"
```

License
-------

[Creative Commons ― CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
