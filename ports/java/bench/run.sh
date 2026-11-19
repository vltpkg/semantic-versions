#!/usr/bin/env bash
# Benchmarks semantic-versions against semver4j and java-semver. Fetches the two
# comparison jars from Maven Central into bench/lib (gitignored), then compiles
# and runs bench/src. Pass --quick for a fast run that does not write results.
set -euo pipefail
cd "$(dirname "$0")"
SEMVER4J=${SEMVER4J:-6.0.0}
JSEMVER=${JSEMVER:-0.10.2}
JSPECIFY=${JSPECIFY:-1.0.0}
mkdir -p lib build
fetch() { # group artifact version
  local jar="lib/$2-$3.jar"
  [ -f "$jar" ] || curl -fsSL -o "$jar" "https://repo1.maven.org/maven2/${1//.//}/$2/$3/$2-$3.jar"
}
fetch org.semver4j semver4j "$SEMVER4J"
fetch com.github.zafarkhaja java-semver "$JSEMVER"
fetch org.jspecify jspecify "$JSPECIFY"
CP="lib/semver4j-$SEMVER4J.jar:lib/java-semver-$JSEMVER.jar:lib/jspecify-$JSPECIFY.jar"
javac -nowarn -cp "$CP" -d build $(find ../src/main ../src/test/java/xyz/semver/Json.java src -name '*.java')
java -Dsemver4j.version="$SEMVER4J" -Djsemver.version="$JSEMVER" -cp "build:$CP" xyz.semver.bench.Compare "$@"
