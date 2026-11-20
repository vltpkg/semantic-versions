package semanticversions_test

import (
	"fmt"

	sv "semver.xyz/go"
)

func Example() {
	v, _ := sv.Parse("1.2.3-beta.4+build.7")
	fmt.Println(v.Major, v.Minor, v.Patch, v.Pre, v.Build)

	// Builds participate in precedence: a build ranks above its plain release.
	fmt.Println(sv.MustParse("1.0.0").Less(sv.MustParse("1.0.0+build.1")))

	fmt.Println(sv.Satisfies("1.4.0", "^1.2.3"))
	fmt.Println(sv.Satisfies("1.0.0-rc.1", "^1.0.0-rc"))     // pre-release channel
	fmt.Println(sv.Satisfies("1.0.0-beta", "^1.0.0-rc"))     // a different channel
	fmt.Println(sv.Satisfies("1.4.2+win.x64", "^1.0.0+win")) // build channel
	fmt.Println(sv.ValidRange("~>1.2"))

	// Contexts scope a version or range to an identity.
	react := sv.MustParseRange("npm:react@^18")
	fmt.Println(react.Test(sv.MustParse("npm:react@18.2.0")), react.Test(sv.MustParse("go:react@18.2.0")))

	fmt.Println(sv.MaxSatisfying([]string{"1.0.0", "1.9.0", "2.0.0"}, "^1"))
	// Output:
	// 1 2 3 beta.4 build.7
	// true
	// true
	// true
	// false
	// true
	// >=1.2.0 <2.0.0-0 true
	// true false
	// 1.9.0 true
}
