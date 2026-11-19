# frozen_string_literal: true

# Runs the shared conformance suite (../../conformance) against this gem.
require "json"
require "minitest/autorun"
require_relative "../lib/semantic_versions"

SUITE = File.expand_path("../../../conformance", __dir__)

def cases(name)
  JSON.parse(File.read(File.join(SUITE, "#{name}.json")))["cases"]
end

class ConformanceTest < Minitest::Test
  SV = SemanticVersions

  def test_versions
    cases("versions").each do |c|
      if c["valid"]
        v = SV.parse(c["input"])
        assert_equal c["version"], v.to_s, c["input"]
        assert_equal c["context"], v.context, c["input"] if c.key?("context")
      else
        assert_nil SV.valid(c["input"]), c["input"]
      end
    end
  end

  def test_precedence
    cases("precedence").each do |c|
      assert_equal c["expected"], SV.compare(c["a"], c["b"]), "#{c["a"]} vs #{c["b"]}"
      assert_equal(-c["expected"], SV.compare(c["b"], c["a"]), "#{c["b"]} vs #{c["a"]}")
    end
  end

  def test_ranges
    cases("ranges").each do |c|
      assert_equal c["expected"], SV.satisfies?(c["version"], c["range"]), "#{c["version"]} in #{c["range"]}"
    end
  end

  def test_desugar
    cases("desugar").each do |c|
      assert_includes [c["output"], *c.fetch("accept", [])], SV.valid_range(c["input"]), c["input"]
    end
  end

  def test_helpers
    vs = ["1.0.0", "2.0.0-rc.1", "1.5.0", "2.0.0", "1.5.0+build"]
    assert_equal "1.5.0+build", SV.max_satisfying(vs, "^1")
    assert_equal "1.0.0", SV.min_satisfying(vs, "^1")
    assert_equal ["1.0.0", "1.5.0", "1.5.0+build", "2.0.0-rc.1", "2.0.0"], SV.sort(vs)
    assert_equal "2.0.0", SV.rsort(vs).first
    assert_equal "*", SV.valid_range(">=0.0.0")
    assert SV::Range.new("npm:react@^18").test(SV.parse("npm:react@18.2.0"))
    refute SV::Range.new("npm:react@^18").test(SV.parse("18.2.0"))
    assert_raises(SV::InvalidVersion) { SV.parse("1.2") }
    assert_operator SV.parse("1.0.0+build"), :>, SV.parse("1.0.0")
  end
end
