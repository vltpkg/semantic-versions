module github.com/vltpkg/semantic-versions/ports/go/bench

go 1.22

require (
	github.com/Masterminds/semver/v3 v3.5.0
	github.com/blang/semver/v4 v4.0.0
	github.com/vltpkg/semantic-versions/ports/go v0.0.0
)

replace github.com/vltpkg/semantic-versions/ports/go => ../
