`semver.xyz`

- creates new "semver" spec
- semver `2.0.0` compatible
- defines implementations (ie. `semantic-versions`)
- defines comparators
- leading `"="` or `"v"` characters are **only** ever stripped off & ignored when passed through `.coerce`
- adds ranges (pulling in Ruby gems concepts, ie. `~>`)
- adds clear licensing
- adds definition for build metadata sorting (aka. alpha-numeric )
- date-versioned (ie. "semver-2023" rhymes with `semver.xyz`)
- online visual/validation tool
