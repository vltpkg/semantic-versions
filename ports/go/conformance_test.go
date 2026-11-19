package semanticversions

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type suite struct {
	Cases []map[string]any `json:"cases"`
}

func load(t *testing.T, name string) []map[string]any {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", "conformance", name+".json"))
	if err != nil {
		t.Fatal(err)
	}
	var s suite
	if err := json.Unmarshal(b, &s); err != nil {
		t.Fatal(err)
	}
	return s.Cases
}

func str(c map[string]any, k string) string { s, _ := c[k].(string); return s }

func TestVersions(t *testing.T) {
	for _, c := range load(t, "versions") {
		in := str(c, "input")
		v, err := Parse(in)
		if c["valid"].(bool) {
			if err != nil || v.String() != str(c, "version") {
				t.Errorf("Parse(%q) = %q, %v; want %q", in, v.String(), err, str(c, "version"))
			}
			if ctx, ok := c["context"].(string); ok && v.Context != ctx {
				t.Errorf("Parse(%q).Context = %q; want %q", in, v.Context, ctx)
			}
		} else if err == nil {
			t.Errorf("Parse(%q) accepted; want error", in)
		}
	}
}

func TestPrecedence(t *testing.T) {
	for _, c := range load(t, "precedence") {
		want := int(c["expected"].(float64))
		got, err := Compare(str(c, "a"), str(c, "b"))
		back, _ := Compare(str(c, "b"), str(c, "a"))
		if err != nil || got != want || back != -want {
			t.Errorf("Compare(%q, %q) = %d, %v; want %d", str(c, "a"), str(c, "b"), got, err, want)
		}
	}
}

func TestRanges(t *testing.T) {
	for _, c := range load(t, "ranges") {
		if got := Satisfies(str(c, "version"), str(c, "range")); got != c["expected"].(bool) {
			t.Errorf("Satisfies(%q, %q) = %v", str(c, "version"), str(c, "range"), got)
		}
	}
}

func TestDesugar(t *testing.T) {
	for _, c := range load(t, "desugar") {
		got, _ := ValidRange(str(c, "input"))
		ok := got == str(c, "output")
		if acc, has := c["accept"].([]any); has {
			for _, a := range acc {
				ok = ok || got == a.(string)
			}
		}
		if !ok {
			t.Errorf("ValidRange(%q) = %q; want %q", str(c, "input"), got, str(c, "output"))
		}
	}
}

func TestHelpers(t *testing.T) {
	vs := []string{"1.0.0", "2.0.0-rc.1", "1.5.0", "2.0.0", "1.5.0+build"}
	if got, _ := MaxSatisfying(vs, "^1"); got != "1.5.0+build" {
		t.Errorf("MaxSatisfying = %q", got)
	}
	if got, _ := MinSatisfying(vs, "^1"); got != "1.0.0" {
		t.Errorf("MinSatisfying = %q", got)
	}
	if got, _ := ValidRange(">=0.0.0"); got != "*" {
		t.Errorf("ValidRange(>=0.0.0) = %q", got)
	}
	if !MustParseRange("npm:react@^18").Test(MustParse("npm:react@18.2.0")) || MustParseRange("npm:react@^18").Test(MustParse("18.2.0")) {
		t.Error("context scoping")
	}
}
