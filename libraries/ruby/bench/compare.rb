# frozen_string_literal: true

# Benchmarks semantic-versions against semantic_range (a port of node-semver)
# and RubyGems' Gem::Version on real-world inputs, and scores all three against
# the shared conformance suite. Writes ../../../benchmarks/results/ruby.json.
#
#   bundle install && bundle exec ruby bench/compare.rb   (from libraries/ruby)
#   ... --quick                                           (fast run, no results)

require "date"
require "etc"
require "json"
require "rbconfig"
require "semantic_range"
require_relative "../lib/semantic_versions"

ROOT = File.expand_path("../../..", __dir__)
QUICK = ARGV.include?("--quick")
SV = SemanticVersions

def now_ns
  Process.clock_gettime(Process::CLOCK_MONOTONIC, :nanosecond)
end

# Median nanoseconds per operation of the block, which performs ops operations.
def measure(ops)
  sample, samples = QUICK ? [60_000_000, 5] : [250_000_000, 15]
  warm = now_ns + 200_000_000
  yield while now_ns < warm
  results = Array.new(samples) do
    start = now_ns
    calls = 0
    loop do
      yield
      calls += 1
      break if now_ns - start >= sample
    end
    (now_ns - start).to_f / (calls * ops)
  end
  results.sort[results.length / 2]
end

def attempt
  yield
rescue StandardError
  nil
end

# ------------------------------------------------------------------ adapters

def sr_version(s)
  SemanticRange::Version.new(s)
end

def sr_satisfies(v, r)
  range = SemanticRange::Range.new(r)
  version = attempt { sr_version(v) }
  version ? range.test(version) : false
end

LIBS = [
  {
    name: "semantic-versions",
    version: SV::VERSION,
    parse: ->(s) { SV::Version.parse(s) },
    normalized: ->(s) { SV::Version.parse(s).to_s },
    context: ->(s) { SV::Version.parse(s).context },
    compare: ->(a, b) { SV.compare(a, b) },
    satisfies: ->(v, r) { SV::Range.new(r) && SV.satisfies?(v, r) },
    range: ->(r) { SV::Range.new(r) },
    desugar: ->(r) { SV.valid_range(r) }
  },
  {
    name: "semantic_range",
    version: SemanticRange::VERSION,
    parse: ->(s) { sr_version(s) },
    # .version drops the build; rebuild it so the library is scored on what it
    # parsed rather than on formatting.
    normalized: lambda { |s|
      v = sr_version(s)
      build = v.instance_variable_get(:@build)
      build.empty? ? v.version : "#{v.version}+#{build.join(".")}"
    },
    context: ->(_s) {},
    compare: ->(a, b) { SemanticRange.compare(a, b) },
    satisfies: ->(v, r) { sr_satisfies(v, r) },
    range: ->(r) { SemanticRange::Range.new(r) },
    desugar: lambda { |r|
      out = SemanticRange.valid_range(r)
      out.nil? || !out.empty? ? out : "*"
    }
  },
  {
    name: "Gem::Version",
    version: Gem::VERSION,
    parse: ->(s) { Gem::Version.new(s) },
    normalized: ->(s) { Gem::Version.new(s).to_s },
    context: ->(_s) {},
    compare: ->(a, b) { Gem::Version.new(a) <=> Gem::Version.new(b) },
    satisfies: ->(v, r) { Gem::Requirement.new(r).satisfied_by?(Gem::Version.new(v)) },
    range: ->(r) { Gem::Requirement.new(r) },
    desugar: nil
  }
].freeze

def cases(name)
  JSON.parse(File.read(File.join(ROOT, "conformance", "#{name}.json")))["cases"]
end

def conformance(lib)
  by = Hash.new { |h, k| h[k] = { "passed" => 0, "total" => 0 } }
  tally = lambda do |cat, ok|
    by[cat]["total"] += 1
    by[cat]["passed"] += 1 if ok
  end
  cases("versions").each do |c|
    ok = if c["valid"]
           attempt { lib[:normalized].(c["input"]) } == c["version"] &&
             (!c.key?("context") || attempt { lib[:context].(c["input"]) } == c["context"])
         else
           attempt { lib[:parse].(c["input"]) }.nil?
         end
    tally.(c["category"], ok)
  end
  cases("precedence").each do |c|
    got = attempt { lib[:compare].(c["a"], c["b"]) }
    tally.(c["category"], !got.nil? && (got <=> 0) == c["expected"])
  end
  cases("ranges").each do |c|
    tally.(c["category"], (attempt { lib[:satisfies].(c["version"], c["range"]) } ? true : false) == c["expected"])
  end
  if lib[:desugar]
    cases("desugar").each do |c|
      got = attempt { lib[:desugar].(c["input"]) }
      tally.(c["category"], got == c["output"] || c.fetch("accept", []).include?(got))
    end
  end
  by.sort.to_h
end

def cpu_model
  File.foreach("/proc/cpuinfo") { |l| return l.split(":", 2)[1].strip if l.start_with?("model name") }
  "unknown"
rescue Errno::ENOENT
  `sysctl -n machdep.cpu.brand_string 2>/dev/null`.strip.then { |s| s.empty? ? "unknown" : s }
end

corpus = JSON.parse(File.read(File.join(ROOT, "benchmarks", "corpus.json")))
versions = corpus["versions"]
all_ranges = corpus["ranges"]
packages = corpus["packages"]
ranges = all_ranges.select { |r| attempt { SV::Range.new(r) } && attempt { SemanticRange::Range.new(r) } }
comparable = ranges.to_h { [_1, true] }
resolutions = corpus["resolutions"].select { |_, r| comparable[r] }
pairs = resolutions.sum { |n, _| packages[n].length }
tasks = []

row = lambda do |id, label, description, results|
  results.each { |name, ns| warn format("%-10s %-18s %10.1f ns/op", id, name, ns) }
  tasks << {
    id: id, label: label, description: description,
    results: results.transform_values { |ns| { nsPerOp: ns.round(1), opsPerSec: (1e9 / ns).round } }
  }
end

n = versions.length
row.("parse", "Parse a version", "#{n} published versions", {
  "semantic-versions" => measure(n) { versions.each { |s| attempt { SV::Version.parse(s) } } },
  "semantic_range" => measure(n) { versions.each { |s| attempt { sr_version(s) } } },
  # Gem::Version.new memoizes instances by string, so timing it on a repeated
  # corpus measures a hash lookup; allocate + initialize does the real work.
  "Gem::Version" => measure(n) { versions.each { |s| attempt { Gem::Version.allocate.send(:initialize, s) } } }
})

svs = versions.filter_map { |s| attempt { SV::Version.parse(s) } }
srs = versions.filter_map { |s| attempt { sr_version(s) } }
gvs = versions.filter_map { |s| attempt { Gem::Version.new(s) } }
row.("sort", "Sort versions", "#{n} parsed versions by precedence (per version)", {
  "semantic-versions" => measure(svs.length) { svs.sort },
  "semantic_range" => measure(srs.length) { srs.sort { |a, b| a.compare(b) } },
  "Gem::Version" => measure(gvs.length) { gvs.sort }
})

row.("range", "Parse a range", "#{ranges.length} real dependency ranges", {
  "semantic-versions" => measure(ranges.length) { ranges.each { |r| SV::Range.new(r) } },
  "semantic_range" => measure(ranges.length) { ranges.each { |r| SemanticRange::Range.new(r) } }
})

sv_pkgs = packages.transform_values { |vs| vs.filter_map { |s| attempt { SV::Version.parse(s) } } }
sr_pkgs = packages.transform_values { |vs| vs.filter_map { |s| attempt { sr_version(s) } } }
sv_pairs = resolutions.map { |name, r| [SV::Range.new(r), sv_pkgs[name]] }
sr_pairs = resolutions.map { |name, r| [SemanticRange::Range.new(r), sr_pkgs[name]] }
row.("satisfies", "range.test(version)", "#{pairs} version × range checks", {
  "semantic-versions" => measure(pairs) { sv_pairs.each { |r, vs| vs.each { |v| r.test(v) } } },
  "semantic_range" => measure(pairs) { sr_pairs.each { |r, vs| vs.each { |v| r.test(v) } } }
})

row.("resolve", "Resolve a range", "#{resolutions.length} max-satisfying lookups against a package's versions", {
  "semantic-versions" => measure(resolutions.length) do
    resolutions.each do |name, r|
      range = SV::Range.new(r)
      sv_pkgs[name].select { |v| range.test(v) }.max
    end
  end,
  "semantic_range" => measure(resolutions.length) do
    resolutions.each do |name, r|
      range = SemanticRange::Range.new(r)
      sr_pkgs[name].select { |v| range.test(v) }.max { |a, b| a.compare(b) }
    end
  end
})

out = {
  language: "Ruby",
  subject: "semantic-versions",
  baseline: "semantic_range",
  environment: {
    runtime: "ruby #{RUBY_VERSION}#{defined?(RubyVM::YJIT) && RubyVM::YJIT.enabled? ? " +YJIT" : ""}",
    cpu: cpu_model,
    platform: "#{RbConfig::CONFIG["host_os"].sub(/-gnu$/, "")} #{RbConfig::CONFIG["host_cpu"]}",
    date: Date.today.iso8601
  },
  libraries: LIBS.to_h { |l| [l[:name], { version: l[:version] }] },
  corpus: { versions: n, ranges: all_ranges.length, comparableRanges: ranges.length, fetched: corpus["fetched"] },
  coverage: LIBS.to_h do |l|
    [l[:name], {
      versions: versions.count { |v| attempt { l[:parse].(v) } },
      ranges: all_ranges.count { |r| attempt { l[:range].(r) } }
    }]
  end,
  tasks: tasks,
  conformance: LIBS.to_h { |l| [l[:name], conformance(l)] },
  notes: {
    "Gem::Version" => "Parsing is timed without Gem::Version.new's per-string cache, and Gem::Version defers splitting into segments until the first comparison (part of its sort time). RubyGems' own requirement syntax (~> 1.2, comma-separated comparators, no ^, || or x-ranges) and lenient versions (1.2 is accepted), so it is compared on versions only."
  }
}
File.write(File.join(ROOT, "benchmarks", "results", "ruby.json"), "#{JSON.pretty_generate(out)}\n") unless QUICK
puts JSON.pretty_generate(out[:conformance].transform_values { |c| c.values.sum { _1["passed"] }.to_s + "/" + c.values.sum { _1["total"] }.to_s })
