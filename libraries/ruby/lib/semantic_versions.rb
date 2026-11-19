# frozen_string_literal: true

# Parse, compare and match versions per the Semantic Versions specification
# (https://semver.xyz). A port of the JavaScript reference implementation
# (semantic-versions on npm), checked against the same conformance suite.
require_relative "semantic_versions/version"

module SemanticVersions
  MAX_LENGTH = 256
  MAX_SAFE_INTEGER = 9_007_199_254_740_991

  class Error < ArgumentError; end
  class InvalidVersion < Error; end
  class InvalidRange < Error; end

  NUM = "(?:0|[1-9][0-9]*)"
  PRE_ID = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)"
  BUILD_ID = "[0-9A-Za-z-]+"
  PRE = "#{PRE_ID}(?:\\.#{PRE_ID})*"
  BUILD = "#{BUILD_ID}(?:\\.#{BUILD_ID})*"
  VERSION_RE = /\A(#{NUM})\.(#{NUM})\.(#{NUM})(?:-(#{PRE}))?(?:\+(#{BUILD}))?\z/
  PLAIN_RE = /\A#{NUM}\.#{NUM}\.#{NUM}\z/
  PRE_RE = /\A#{PRE}\z/
  BUILD_RE = /\A#{BUILD}\z/
  XR = "(?:[xX*]|0|[1-9][0-9]*)"
  PARTIAL_RE = /\A(#{XR})(?:\.(#{XR})(?:\.(#{XR})(?:-([^+]*))?(?:\+(.*))?)?)?\z/m
  TUPLE_PRE_RE = /\A(<=|>=|\^|~|<|>|=)?(#{NUM})\.(#{NUM})\.(#{NUM})-\*\z/
  private_constant :NUM, :PRE_ID, :BUILD_ID, :PRE, :BUILD, :VERSION_RE, :PLAIN_RE, :PRE_RE, :BUILD_RE,
                   :XR, :PARTIAL_RE, :TUPLE_PRE_RE

  # A release ranks above its pre-releases; a build ranks above its release.
  RELEASE = [1, [].freeze].freeze
  NO_BUILD = [0, [].freeze].freeze
  private_constant :RELEASE, :NO_BUILD

  module Util # :nodoc:
    module_function

    def safe?(n)
      n.length <= 16 && n.to_i <= MAX_SAFE_INTEGER
    end

    # The JavaScript reference requires numeric pre-release identifiers to be
    # below MAX_SAFE_INTEGER.
    def pre_safe?(pre)
      pre.split(".").none? { |i| i.length >= 16 && i.match?(/\A\d+\z/) && i.to_i >= MAX_SAFE_INTEGER }
    end

    # Numeric identifiers sort numerically and below alphanumeric ones.
    def ids_key(ids)
      ids.split(".").map { |i| i.match?(/\A\d+\z/) ? [0, i.to_i] : [1, i] }
    end

    # Identifier-wise prefix: "rc" begins "rc.1" but not "rc1".
    def starts_with?(ids, prefix)
      prefix.empty? || ids == prefix || ids.start_with?("#{prefix}.")
    end
  end
  private_constant :Util

  # Split an optional context off a reference: "npm:react@1.2.3" →
  # ["npm:react", "1.2.3"]. The context ends at the last "@" of the first
  # whitespace-delimited token; an "@" at position 0 means there is none.
  def self.split_reference(value)
    return [nil, value] unless value.include?("@")

    i = value =~ /\s/
    head, tail = i ? [value[0...i], value[i..]] : [value, ""]
    at = head.rindex("@")
    at&.positive? ? [head[0...at], head[(at + 1)..] + tail] : [nil, value]
  end

  # A parsed Semantic Version, optionally scoped to a context.
  #
  # Ordering follows the specification: pre-releases rank below their release
  # and builds rank above it (1.0.0-rc < 1.0.0 < 1.0.0+build). The context
  # never participates in precedence or equality.
  class Version
    include Comparable

    # The precedence key: [major, minor, patch, pre-release key, build key].
    attr_reader :key
    attr_reader :pre, :build, :context

    def initialize(major, minor, patch, pre = "", build = "", context = nil)
      # Few instance variables keep the object small (major, minor and patch
      # live in the key).
      @key = [major, minor, patch,
              pre.empty? ? RELEASE : [0, Util.ids_key(pre)],
              build.empty? ? NO_BUILD : [1, Util.ids_key(build)]]
      @pre = pre
      @build = build
      @context = context
    end

    def major
      @key[0]
    end

    def minor
      @key[1]
    end

    def patch
      @key[2]
    end

    # Parse a version, optionally context-qualified ("npm:react@1.2.3").
    # There is no coercion: "v1.2.3" and "1.2" raise InvalidVersion.
    def self.parse(value)
      raise InvalidVersion, "version is longer than #{MAX_LENGTH} characters" if value.length > MAX_LENGTH

      # Fast path: most versions are a bare major.minor.patch.
      if value.length < 16 && PLAIN_RE.match?(value)
        major, minor, patch = value.split(".")
        return new(major.to_i, minor.to_i, patch.to_i)
      end

      context = nil
      m = VERSION_RE.match(value)
      if m.nil?
        context, rest = SemanticVersions.split_reference(value)
        m = VERSION_RE.match(rest.strip)
        raise InvalidVersion, "invalid version: #{value.inspect}" if m.nil?
      end
      major, minor, patch, pre, build = m.captures
      if value.length >= 16
        raise InvalidVersion, "version component too large: #{value.inspect}" unless
          Util.safe?(major) && Util.safe?(minor) && Util.safe?(patch)
        raise InvalidVersion, "pre-release identifier too large: #{value.inspect}" if pre && !Util.pre_safe?(pre)
      end
      new(major.to_i, minor.to_i, patch.to_i, pre || "", build || "", context)
    end

    def prerelease?
      !@pre.empty?
    end

    def without_build
      Version.new(@key[0], @key[1], @key[2], @pre, "", @context)
    end

    # The context-qualified form, "context@version", or the bare version.
    def reference
      @context ? "#{@context}@#{self}" : to_s
    end

    def <=>(other)
      other.is_a?(Version) ? @key <=> other.key : nil
    end

    def eql?(other)
      other.is_a?(Version) && @key == other.key
    end

    def hash
      @key.hash
    end

    def to_s
      s = +"#{@key[0]}.#{@key[1]}.#{@key[2]}"
      s << "-" << @pre unless @pre.empty?
      s << "+" << @build unless @build.empty?
      s
    end

    def inspect
      "#<SemanticVersions::Version #{reference}>"
    end
  end

  # A primitive comparator: an operator and a bound, or "any". A build on the
  # bound is a build channel (a prefix filter on the candidate's build); a
  # pre-release on it declares a pre-release channel for its tuple.
  class Comparator
    attr_reader :op, :version

    def initialize(op, version)
      @op = op
      @version = version
      @bound = version&.key&.first(4)
      @channel = version&.build
    end

    # ">=0.0.0" bounds nothing: it is the "any" comparator.
    def self.make(op, version)
      if op == ">=" && version.major.zero? && version.minor.zero? && version.patch.zero? &&
         version.pre.empty? && version.build.empty?
        return ANY
      end

      new(op, version)
    end

    def any?
      @version.nil?
    end

    def null?
      v = @version
      !v.nil? && @op == "<" && v.major.zero? && v.minor.zero? && v.patch.zero? && v.pre == "0" && v.build.empty?
    end

    def test(version)
      return true if @bound.nil?

      k = version.key
      b = @bound
      c = k[0] <=> b[0]
      c = k[1] <=> b[1] if c.zero?
      c = k[2] <=> b[2] if c.zero?
      c = k[3] <=> b[3] if c.zero?
      ok = case @op
           when "<" then c.negative?
           when ">=" then c >= 0
           when "<=" then c <= 0
           when ">" then c.positive?
           else c.zero?
           end
      ok && (@channel.empty? || Util.starts_with?(version.build, @channel))
    end

    def same?(other)
      return false unless @op == other.op

      a = @version
      b = other.version
      return a.nil? && b.nil? if a.nil? || b.nil?

      a.major == b.major && a.minor == b.minor && a.patch == b.patch && a.pre == b.pre && a.build == b.build
    end

    def to_s
      @version.nil? ? "" : "#{@op}#{@version}"
    end

    ANY = new("", nil)
  end

  ANY = Comparator::ANY
  private_constant :ANY

  # A parsed range: comparator sets joined by "||", optionally scoped to a
  # context ("npm:react@^18"). Advanced syntax (hyphen, x-ranges, ~, ~>, ^,
  # -*, *-*) desugars to primitive comparators exactly as in the spec.
  class Range
    Partial = Struct.new(:major, :minor, :patch, :pre, :build) # :nodoc:
    ComparatorSet = Struct.new(:comparators, :universal_pre, :any_pre) do # :nodoc:
      def test(v)
        return false unless comparators.all? { |c| c.test(v) }
        return true if v.pre.empty? || universal_pre
        return true if any_pre.include?([v.major, v.minor, v.patch])

        # A pre-release is admitted only by a comparator that declares a
        # channel on the same tuple whose identifiers it begins with.
        comparators.any? do |c|
          b = c.version
          b && !b.pre.empty? && b.major == v.major && b.minor == v.minor && b.patch == v.patch &&
            Util.starts_with?(v.pre, b.pre)
        end
      end
    end
    private_constant :Partial, :ComparatorSet

    OPERATORS = %w[< <= > >= = ~ ~> ^].freeze
    PREFIXES = [">=", "<=", ">", "<", "="].freeze
    private_constant :OPERATORS, :PREFIXES

    attr_reader :raw, :context

    def initialize(value)
      raise InvalidRange, "range is longer than #{MAX_LENGTH} characters" if value.length > MAX_LENGTH

      @raw = value
      @context, body = SemanticVersions.split_reference(value)
      # "".split returns [], but an empty range is one set that matches all.
      parts = body.empty? ? [body] : body.split("||", -1)
      sets = parts.map { |part| parse_set(part.strip) }
      if sets.length > 1
        # Drop sets that can match nothing (unless that is all there is), and
        # collapse to "any" if any set matches everything.
        first = sets.first
        sets = sets.reject { |s| s.comparators.first&.null? }
        if sets.empty?
          sets = [first]
        elsif sets.length > 1
          universal = sets.find { |s| s.comparators.length == 1 && s.comparators[0].any? }
          sets = [universal] if universal
        end
      end
      @sets = sets
    end

    def self.parse(value)
      new(value)
    end

    def comparator_sets
      @sets.map { |s| s.comparators.dup }
    end

    # True if version satisfies the range. A context-scoped range only admits
    # versions of the same context.
    def test(version)
      return false if @context && version.context != @context

      @sets.any? { |s| s.test(version) }
    end
    alias satisfied_by? test
    alias include? test
    alias === test

    def to_s
      @sets.map { |s| s.comparators.reject(&:any?).join(" ") }.join("||")
    end

    def inspect
      "#<SemanticVersions::Range #{@raw.inspect}>"
    end

    private

    def invalid!
      raise InvalidRange, "invalid range: #{@raw.inspect}"
    end

    def xr(s)
      return nil if s.nil? || s == "x" || s == "X" || s == "*"

      invalid! unless Util.safe?(s)
      s.to_i
    end

    def partial(s)
      m = PARTIAL_RE.match(s) || invalid!
      major, minor, patch, pre, build = m.captures
      invalid! if pre && (!PRE_RE.match?(pre) || !Util.pre_safe?(pre))
      invalid! if build && !BUILD_RE.match?(build)
      Partial.new(xr(major), xr(minor), xr(patch), pre || "", build || "")
    end

    def v(major, minor, patch, pre = "")
      Version.new(major, minor, patch, pre)
    end

    def cmp(op, version)
      Comparator.make(op, version)
    end

    def with_channel(comps, channel)
      return comps if channel.empty?

      comps.map do |c|
        if c.any?
          # A channel turns ">=0.0.0" back into a real bound.
          Comparator.new(">=", Version.new(0, 0, 0, "", channel))
        else
          b = c.version
          Comparator.new(c.op, Version.new(b.major, b.minor, b.patch, b.pre, channel))
        end
      end
    end

    def tilde(p)
      return [ANY] if p.major.nil?

      m = p.major
      mi = p.minor || 0
      out = if p.minor.nil?
              [cmp(">=", v(m, 0, 0)), cmp("<", v(m + 1, 0, 0, "0"))]
            elsif p.patch.nil?
              [cmp(">=", v(m, mi, 0)), cmp("<", v(m, mi + 1, 0, "0"))]
            else
              [cmp(">=", v(m, mi, p.patch, p.pre)), cmp("<", v(m, mi + 1, 0, "0"))]
            end
      with_channel(out, p.build)
    end

    def caret(p)
      return [ANY] if p.major.nil?

      m = p.major
      mi = p.minor || 0
      pa = p.patch || 0
      out = if p.minor.nil?
              [cmp(">=", v(m, 0, 0)), cmp("<", v(m + 1, 0, 0, "0"))]
            elsif p.patch.nil?
              upper = m.zero? ? v(0, mi + 1, 0, "0") : v(m + 1, 0, 0, "0")
              [cmp(">=", v(m, mi, 0)), cmp("<", upper)]
            else
              upper = if m.zero?
                        mi.zero? ? v(0, 0, pa + 1, "0") : v(0, mi + 1, 0, "0")
                      else
                        v(m + 1, 0, 0, "0")
                      end
              [cmp(">=", v(m, mi, pa, p.pre)), cmp("<", upper)]
            end
      with_channel(out, p.build)
    end

    def xrange(op, p)
      xm = p.major.nil? || p.minor.nil?
      any_x = xm || p.patch.nil?
      return [%w[> <].include?(op) ? cmp("<", v(0, 0, 0, "0")) : ANY] if p.major.nil?

      m = p.major
      mi = xm ? 0 : p.minor
      if any_x && op != ""
        return [case op
                when ">" then cmp(">=", xm ? v(m + 1, 0, 0) : v(m, mi + 1, 0))
                when "<=" then cmp("<", xm ? v(m + 1, 0, 0, "0") : v(m, mi + 1, 0, "0"))
                when "<" then cmp("<", v(m, mi, 0, "0"))
                else cmp(op, v(m, mi, 0))
                end]
      end
      return [cmp(">=", v(m, 0, 0)), cmp("<", v(m + 1, 0, 0, "0"))] if xm
      return [cmp(">=", v(m, mi, 0)), cmp("<", v(m, mi + 1, 0, "0"))] if p.patch.nil?

      [cmp(op, Version.new(m, mi, p.patch, p.pre, p.build))]
    end

    def hyphen(a, b)
      out = []
      unless a.major.nil?
        lower = if a.minor.nil? then v(a.major, 0, 0)
                elsif a.patch.nil? then v(a.major, a.minor, 0)
                else v(a.major, a.minor, a.patch, a.pre)
                end
        out << cmp(">=", lower)
      end
      unless b.major.nil?
        out << if b.minor.nil? then cmp("<", v(b.major + 1, 0, 0, "0"))
               elsif b.patch.nil? then cmp("<", v(b.major, b.minor + 1, 0, "0"))
               else cmp("<=", v(b.major, b.minor, b.patch, b.pre))
               end
      end
      out.empty? ? [ANY] : out
    end

    def comparator_token(tok)
      return [ANY] if tok.empty? || tok == "*"
      return caret(partial(tok[1..])) if tok.start_with?("^")
      return tilde(partial(tok.start_with?("~>") ? tok[2..] : tok[1..])) if tok.start_with?("~")

      PREFIXES.each do |op|
        return xrange(op == "=" ? "" : op, partial(tok[op.length..])) if tok.start_with?(op)
      end
      xrange("", partial(tok))
    end

    def parse_set(s)
      universal_pre = false
      any_pre = []
      tokens = s.split.map do |tok|
        if tok == "*-*"
          universal_pre = true
          ">=0.0.0-0"
        elsif tok.end_with?("-*") && (m = TUPLE_PRE_RE.match(tok))
          op, a, b, c = m.captures
          any_pre << [a.to_i, b.to_i, c.to_i]
          "#{op}#{a}.#{b}.#{c}-0"
        else
          tok
        end
      end

      comps = []
      if tokens.length == 3 && tokens[1] == "-"
        comps = hyphen(partial(tokens[0]), partial(tokens[2]))
      else
        i = 0
        while i < tokens.length
          # ">= 1.2.3", "~ 1.2": an operator separated from its version.
          if OPERATORS.include?(tokens[i]) && i + 1 < tokens.length
            comps.concat(comparator_token(tokens[i] + tokens[i + 1]))
            i += 2
          else
            comps.concat(comparator_token(tokens[i]))
            i += 1
          end
        end
        comps = [ANY] if comps.empty?
      end

      # A comparator that can match nothing makes the whole set match nothing.
      null = comps.find(&:null?)
      return ComparatorSet.new([null], universal_pre, any_pre) if null

      unique = []
      comps.each { |c| unique << c unless unique.any? { |u| u.same?(c) } }
      unique = unique.reject(&:any?) if unique.length > 1
      ComparatorSet.new(unique, universal_pre, any_pre)
    end
  end

  module_function

  # Parse a version; raises InvalidVersion.
  def parse(version)
    Version.parse(version)
  end

  # The normalized version, or nil if it is not a version.
  def valid(version)
    Version.parse(version).to_s
  rescue Error
    nil
  end

  # The desugared range ("*" when it matches everything), or nil.
  def valid_range(range)
    out = Range.new(range).to_s
    out.empty? ? "*" : out
  rescue Error
    nil
  end

  # -1, 0 or 1 by precedence (builds rank above their release).
  def compare(a, b)
    Version.parse(a) <=> Version.parse(b)
  end

  def satisfies?(version, range)
    # Mirrors the JavaScript reference: an identical string trivially matches.
    return !valid(version).nil? if version == range

    Range.new(range).test(Version.parse(version))
  rescue Error
    false
  end

  # The highest version in versions that satisfies range, or nil.
  def max_satisfying(versions, range)
    pick(versions, range) { |a, b| (a <=> b).positive? }
  end

  # The lowest version in versions that satisfies range, or nil.
  def min_satisfying(versions, range)
    pick(versions, range) { |a, b| (a <=> b).negative? }
  end

  # Versions sorted ascending by precedence (stable).
  def sort(versions)
    versions.each_with_index.sort_by { |s, i| [Version.parse(s).key, i] }.map(&:first)
  end

  # Versions sorted descending by precedence (stable).
  def rsort(versions)
    sort(versions.reverse).reverse
  end

  def pick(versions, range)
    r = begin
      Range.new(range)
    rescue Error
      return nil
    end
    best = best_key = nil
    versions.each do |s|
      v = begin
        Version.parse(s)
      rescue Error
        next
      end
      next unless r.test(v)

      if best.nil? || yield(v.key, best_key)
        best = s
        best_key = v.key
      end
    end
    best
  end
  private_class_method :pick
end
