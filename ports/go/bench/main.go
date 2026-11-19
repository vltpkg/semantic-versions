// Command bench measures semantic-versions against Masterminds/semver (npm-style
// constraints) and blang/semver on real-world inputs, and scores all three
// against the shared conformance suite. Writes ../../../benchmarks/results/go.json.
//
//	go run .          (from ports/go/bench)
//	go run . -quick   (fast run, does not write results)
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"slices"
	"sort"
	"strings"
	"time"

	ms "github.com/Masterminds/semver/v3"
	blang "github.com/blang/semver/v4"
	sv "github.com/vltpkg/semantic-versions/ports/go"
)

var quick = flag.Bool("quick", false, "fast run; do not write results")

var root = filepath.Join("..", "..", "..")

var sink any

// measure returns the median nanoseconds per operation of f, which performs ops operations.
func measure(ops int, f func()) float64 {
	sample, samples := 250*time.Millisecond, 15
	if *quick {
		sample, samples = 60*time.Millisecond, 5
	}
	for end := time.Now().Add(200 * time.Millisecond); time.Now().Before(end); {
		f()
	}
	results := make([]float64, 0, samples)
	for i := 0; i < samples; i++ {
		start := time.Now()
		calls := 0
		for time.Since(start) < sample {
			f()
			calls++
		}
		results = append(results, float64(time.Since(start).Nanoseconds())/float64(calls*ops))
	}
	sort.Float64s(results)
	return results[len(results)/2]
}

type lib struct {
	name       string
	module     string
	parseOK    func(string) bool
	normalized func(string) (string, bool)
	context    func(string) string
	compare    func(a, b string) (int, bool)
	satisfies  func(v, r string) (bool, bool) // result, range accepted
	rangeOK    func(string) bool
	desugar    func(string) (string, bool)
}

func ok[T any](_ T, err error) bool { return err == nil }

var libs = []lib{
	{
		name: "semantic-versions", module: "github.com/vltpkg/semantic-versions/ports/go",
		parseOK:    func(s string) bool { return ok(sv.Parse(s)) },
		normalized: sv.Valid,
		context:    func(s string) string { v, _ := sv.Parse(s); return v.Context },
		compare:    func(a, b string) (int, bool) { c, err := sv.Compare(a, b); return c, err == nil },
		satisfies: func(v, r string) (bool, bool) {
			if _, err := sv.ParseRange(r); err != nil {
				return false, false
			}
			return sv.Satisfies(v, r), true
		},
		rangeOK: func(r string) bool { return ok(sv.ParseRange(r)) },
		desugar: sv.ValidRange,
	},
	{
		name: "Masterminds/semver", module: "github.com/Masterminds/semver/v3",
		parseOK: func(s string) bool { return ok(ms.NewVersion(s)) },
		normalized: func(s string) (string, bool) {
			v, err := ms.NewVersion(s)
			if err != nil {
				return "", false
			}
			return v.String(), true
		},
		context: func(string) string { return "" },
		compare: func(a, b string) (int, bool) {
			x, e1 := ms.NewVersion(a)
			y, e2 := ms.NewVersion(b)
			if e1 != nil || e2 != nil {
				return 0, false
			}
			return x.Compare(y), true
		},
		satisfies: func(v, r string) (bool, bool) {
			c, err := ms.NewConstraint(r)
			if err != nil {
				return false, false
			}
			x, err := ms.NewVersion(v)
			return err == nil && c.Check(x), true
		},
		rangeOK: func(r string) bool { return ok(ms.NewConstraint(r)) },
	},
	{
		name: "blang/semver", module: "github.com/blang/semver/v4",
		parseOK: func(s string) bool { return ok(blang.Parse(s)) },
		normalized: func(s string) (string, bool) {
			v, err := blang.Parse(s)
			if err != nil {
				return "", false
			}
			return v.String(), true
		},
		context: func(string) string { return "" },
		compare: func(a, b string) (int, bool) {
			x, e1 := blang.Parse(a)
			y, e2 := blang.Parse(b)
			if e1 != nil || e2 != nil {
				return 0, false
			}
			return x.Compare(y), true
		},
		satisfies: func(v, r string) (bool, bool) {
			rg, err := blang.ParseRange(r)
			if err != nil {
				return false, false
			}
			x, err := blang.Parse(v)
			return err == nil && rg(x), true
		},
		rangeOK: func(r string) bool { return ok(blang.ParseRange(r)) },
	},
}

type tally struct {
	Passed int `json:"passed"`
	Total  int `json:"total"`
}

func cases(name string) []map[string]any {
	b, err := os.ReadFile(filepath.Join(root, "conformance", name+".json"))
	if err != nil {
		panic(err)
	}
	var s struct{ Cases []map[string]any }
	if err := json.Unmarshal(b, &s); err != nil {
		panic(err)
	}
	return s.Cases
}

func str(c map[string]any, k string) string { s, _ := c[k].(string); return s }

func conformance(l lib) map[string]*tally {
	by := map[string]*tally{}
	add := func(cat string, pass bool) {
		t := by[cat]
		if t == nil {
			t = &tally{}
			by[cat] = t
		}
		t.Total++
		if pass {
			t.Passed++
		}
	}
	for _, c := range cases("versions") {
		in := str(c, "input")
		var pass bool
		if c["valid"].(bool) {
			got, okv := l.normalized(in)
			pass = okv && got == str(c, "version")
			if ctx, has := c["context"].(string); has {
				pass = pass && l.context(in) == ctx
			}
		} else {
			pass = !l.parseOK(in)
		}
		add(str(c, "category"), pass)
	}
	for _, c := range cases("precedence") {
		got, okc := l.compare(str(c, "a"), str(c, "b"))
		if got > 0 {
			got = 1
		} else if got < 0 {
			got = -1
		}
		add(str(c, "category"), okc && got == int(c["expected"].(float64)))
	}
	for _, c := range cases("ranges") {
		got, _ := l.satisfies(str(c, "version"), str(c, "range"))
		add(str(c, "category"), got == c["expected"].(bool))
	}
	if l.desugar != nil {
		for _, c := range cases("desugar") {
			got, okd := l.desugar(str(c, "input"))
			pass := okd && got == str(c, "output")
			if acc, has := c["accept"].([]any); has && okd {
				for _, a := range acc {
					pass = pass || got == a.(string)
				}
			}
			add(str(c, "category"), pass)
		}
	}
	return by
}

type result struct {
	NsPerOp   float64 `json:"nsPerOp"`
	OpsPerSec float64 `json:"opsPerSec"`
}

type task struct {
	ID          string            `json:"id"`
	Label       string            `json:"label"`
	Description string            `json:"description"`
	Results     map[string]result `json:"results"`
}

func main() {
	flag.Parse()
	var corpus struct {
		Fetched     string              `json:"fetched"`
		Versions    []string            `json:"versions"`
		Ranges      []string            `json:"ranges"`
		Packages    map[string][]string `json:"packages"`
		Resolutions [][2]string         `json:"resolutions"`
	}
	b, err := os.ReadFile(filepath.Join(root, "benchmarks", "corpus.json"))
	if err != nil {
		panic(err)
	}
	if err := json.Unmarshal(b, &corpus); err != nil {
		panic(err)
	}
	versions := corpus.Versions

	// Ranges both npm-syntax libraries accept; blang/semver has its own range
	// syntax (no ^, ~ or x-ranges), so it is compared on versions only.
	var ranges []string
	comparable := map[string]bool{}
	for _, r := range corpus.Ranges {
		if libs[0].rangeOK(r) && libs[1].rangeOK(r) {
			ranges = append(ranges, r)
			comparable[r] = true
		}
	}
	var resolutions [][2]string
	pairs := 0
	for _, r := range corpus.Resolutions {
		if comparable[r[1]] {
			resolutions = append(resolutions, r)
			pairs += len(corpus.Packages[r[0]])
		}
	}

	var tasks []task
	row := func(id, label, desc string, res map[string]float64) {
		t := task{ID: id, Label: label, Description: desc, Results: map[string]result{}}
		for _, l := range libs {
			ns, has := res[l.name]
			if !has {
				continue
			}
			fmt.Fprintf(os.Stderr, "%-10s %-20s %10.1f ns/op\n", id, l.name, ns)
			t.Results[l.name] = result{NsPerOp: float64(int(ns*10+0.5)) / 10, OpsPerSec: float64(int(1e9/ns + 0.5))}
		}
		tasks = append(tasks, t)
	}

	n := len(versions)
	row("parse", "Parse a version", fmt.Sprintf("%d published versions", n), map[string]float64{
		"semantic-versions": measure(n, func() {
			for _, s := range versions {
				v, err := sv.Parse(s)
				sink = err
				_ = v
			}
		}),
		"Masterminds/semver": measure(n, func() {
			for _, s := range versions {
				v, err := ms.NewVersion(s)
				sink = err
				_ = v
			}
		}),
		"blang/semver": measure(n, func() {
			for _, s := range versions {
				v, err := blang.Parse(s)
				sink = err
				_ = v
			}
		}),
	})

	var svs []sv.Version
	var mss []*ms.Version
	var bls []blang.Version
	for _, s := range versions {
		if v, err := sv.Parse(s); err == nil {
			svs = append(svs, v)
		}
		if v, err := ms.NewVersion(s); err == nil {
			mss = append(mss, v)
		}
		if v, err := blang.Parse(s); err == nil {
			bls = append(bls, v)
		}
	}
	row("sort", "Sort versions", fmt.Sprintf("%d parsed versions by precedence (per version)", n), map[string]float64{
		"semantic-versions":  measure(len(svs), func() { l := slices.Clone(svs); sv.Sort(l); sink = l }),
		"Masterminds/semver": measure(len(mss), func() { l := slices.Clone(mss); sort.Sort(ms.Collection(l)); sink = l }),
		"blang/semver":       measure(len(bls), func() { l := slices.Clone(bls); blang.Sort(l); sink = l }),
	})

	row("range", "Parse a range", fmt.Sprintf("%d real dependency ranges", len(ranges)), map[string]float64{
		"semantic-versions": measure(len(ranges), func() {
			for _, r := range ranges {
				x, err := sv.ParseRange(r)
				sink = err
				_ = x
			}
		}),
		"Masterminds/semver": measure(len(ranges), func() {
			for _, r := range ranges {
				x, err := ms.NewConstraint(r)
				sink = err
				_ = x
			}
		}),
	})

	type svPair struct {
		r  sv.Range
		vs []sv.Version
	}
	type msPair struct {
		r  *ms.Constraints
		vs []*ms.Version
	}
	var svp []svPair
	var msp []msPair
	svPkg := map[string][]sv.Version{}
	msPkg := map[string][]*ms.Version{}
	for name, vs := range corpus.Packages {
		for _, s := range vs {
			if v, err := sv.Parse(s); err == nil {
				svPkg[name] = append(svPkg[name], v)
			}
			if v, err := ms.NewVersion(s); err == nil {
				msPkg[name] = append(msPkg[name], v)
			}
		}
	}
	for _, r := range resolutions {
		svp = append(svp, svPair{sv.MustParseRange(r[1]), svPkg[r[0]]})
		c, _ := ms.NewConstraint(r[1])
		msp = append(msp, msPair{c, msPkg[r[0]]})
	}
	row("satisfies", "Range.Test(version)", fmt.Sprintf("%d version × range checks", pairs), map[string]float64{
		"semantic-versions": measure(pairs, func() {
			hits := 0
			for i := range svp {
				for _, v := range svp[i].vs {
					if svp[i].r.Test(v) {
						hits++
					}
				}
			}
			sink = hits
		}),
		"Masterminds/semver": measure(pairs, func() {
			hits := 0
			for i := range msp {
				for _, v := range msp[i].vs {
					if msp[i].r.Check(v) {
						hits++
					}
				}
			}
			sink = hits
		}),
	})

	row("resolve", "Resolve a range", fmt.Sprintf("%d max-satisfying lookups against a package's versions", len(resolutions)), map[string]float64{
		"semantic-versions": measure(len(resolutions), func() {
			for _, res := range resolutions {
				r, _ := sv.ParseRange(res[1])
				var best sv.Version
				found := false
				for _, v := range svPkg[res[0]] {
					if r.Test(v) && (!found || v.Compare(best) > 0) {
						best, found = v, true
					}
				}
				sink = best
			}
		}),
		"Masterminds/semver": measure(len(resolutions), func() {
			for _, res := range resolutions {
				c, _ := ms.NewConstraint(res[1])
				var best *ms.Version
				for _, v := range msPkg[res[0]] {
					if c.Check(v) && (best == nil || v.GreaterThan(best)) {
						best = v
					}
				}
				sink = best
			}
		}),
	})

	conf := map[string]map[string]*tally{}
	coverage := map[string]map[string]int{}
	libraries := map[string]map[string]string{}
	info, _ := debug.ReadBuildInfo()
	for _, l := range libs {
		conf[l.name] = conformance(l)
		cv, cr := 0, 0
		for _, v := range versions {
			if l.parseOK(v) {
				cv++
			}
		}
		for _, r := range corpus.Ranges {
			if l.rangeOK(r) {
				cr++
			}
		}
		coverage[l.name] = map[string]int{"versions": cv, "ranges": cr}
		version := "1.0.0"
		if info != nil {
			for _, d := range info.Deps {
				if d.Path == l.module && d.Version != "(devel)" && d.Replace == nil {
					version = strings.TrimPrefix(d.Version, "v")
				}
			}
		}
		libraries[l.name] = map[string]string{"version": version}
	}
	if *quick {
		for _, l := range libs {
			p, t := 0, 0
			for _, c := range conf[l.name] {
				p += c.Passed
				t += c.Total
			}
			fmt.Fprintf(os.Stderr, "conformance %-20s %d/%d  coverage %v\n", l.name, p, t, coverage[l.name])
		}
		return
	}
	out := map[string]any{
		"language": "Go",
		"subject":  "semantic-versions",
		"baseline": "Masterminds/semver",
		"environment": map[string]string{
			"runtime":  runtime.Version(),
			"cpu":      cpuModel(),
			"platform": runtime.GOOS + " " + runtime.GOARCH,
			"date":     time.Now().Format("2006-01-02"),
		},
		"libraries":   libraries,
		"corpus":      map[string]any{"versions": len(versions), "ranges": len(corpus.Ranges), "comparableRanges": len(ranges), "fetched": corpus.Fetched},
		"coverage":    coverage,
		"tasks":       tasks,
		"conformance": conf,
		"notes": map[string]string{
			"Masterminds/semver": "NewVersion is lenient by design (it accepts v1.2 and coerces it), which is why it fails the strict-parsing cases.",
			"blang/semver":       "Its range syntax has no ^, ~ or x-ranges, so it is compared on versions only.",
		},
	}
	j, _ := json.MarshalIndent(out, "", "  ")
	if err := os.WriteFile(filepath.Join(root, "benchmarks", "results", "go.json"), append(j, '\n'), 0o644); err != nil {
		panic(err)
	}
}

func cpuModel() string {
	if b, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(line, "model name") {
				if _, v, found := strings.Cut(line, ":"); found {
					return strings.TrimSpace(v)
				}
			}
		}
	}
	if out, err := exec.Command("sysctl", "-n", "machdep.cpu.brand_string").Output(); err == nil {
		return strings.TrimSpace(string(out))
	}
	return "unknown"
}
