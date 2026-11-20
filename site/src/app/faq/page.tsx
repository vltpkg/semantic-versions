import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "FAQ — Semantic Versions · semver.xyz",
  alternates: { canonical: "/faq/" },
  description:
    "Frequently asked questions about Semantic Versions: how it differs from semver.org, why minor and patch reset to 0, what counts as a public API, deprecation, Package-URL and more.",
  openGraph: {
    title: "FAQ — Semantic Versions",
    description:
      "How Semantic Versions differs from semver.org, why it keeps MAJOR.MINOR.PATCH, what counts as a public API, and other common questions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">FAQ</p>
        <h1>
          Common questions, <span className="grad">answered.</span>
        </h1>
        <p className="lead">
          The reasoning behind the rules: why some things changed from Semantic Versioning 2.0.0, why others
          deliberately didn't, and how the spec fits alongside the rest of the ecosystem. The normative text is the{" "}
          <a href="/spec/">specification</a>.
        </p>
      </section>
      <div className="doc-layout">
        <aside className="toc reveal" aria-label="Questions">
          <div className="toc-title">Common misconceptions</div>{" "}
          <a href="#package-json">“My package.json uses semver”</a>{" "}
          <a href="#official-standard">“semver.org is a standard”</a>{" "}
          <a href="#same-everywhere">“Every tool reads versions alike”</a>{" "}
          <div className="toc-title">The specification</div> <a href="#semver-org">Differences from semver.org</a>{" "}
          <a href="#reset-to-zero">
            Resetting to <code>0</code>
          </a>{" "}
          <a href="#position-names">
            Why <code>MAJOR.MINOR.PATCH</code>
          </a>{" "}
          <a href="#public-api">Public API &amp; products</a> <a href="#deprecated">Deprecation</a>{" "}
          <div className="toc-title">Ecosystem</div> <a href="#purl">Do I still need purl?</a>{" "}
          <a href="#pep-440">Python's PEP 440</a> <div className="toc-title">The project</div>{" "}
          <a href="#grammar">Grammar</a> <a href="#contributing">Contributing</a> <a href="#license">License</a>
        </aside>
        <article className="doc reveal">
          <h2 id="misconceptions">Common misconceptions</h2>
          <h3 id="package-json">
            Aren’t the versions in my <code>package.json</code> “semver”?
          </h3>
          <p>
            Not quite. What you write under <code>dependencies</code> is a <em>range</em> (<code>^1.2.0</code>,{" "}
            <code>~1.4</code>, <code>&gt;=2 &lt;3</code>, <code>1.x</code>), and{" "}
            <a href="https://semver.org/" target="_blank" rel="noopener">
              Semantic Versioning 2.0.0
            </a>{" "}
            does not define ranges at all. It specifies what a version string looks like and how two versions order;
            carets, tildes, x-ranges, hyphen ranges and <code>||</code> appear nowhere in it. npm’s documentation sends
            you to the{" "}
            <a href="https://github.com/npm/node-semver#ranges" target="_blank" rel="noopener">
              <code>semver</code> package’s README
            </a>{" "}
            for range syntax, and that README carries its own grammar. So the language millions of manifests are written
            in is defined by one library’s documentation, not by the spec it is named after.
          </p>
          <p>
            The same goes for behaviour people assume is “semver”. That <code>^1.0.0</code> never matches{" "}
            <code>2.0.0-rc.1</code> is a node-semver rule: a pre-release only satisfies a range when a comparator on the
            same <code>major.minor.patch</code> carries a pre-release too. Reasonable, widely copied, and nowhere in the
            spec. And a dependency field need not hold a version or range at all: npm also accepts tarball and git URLs,
            GitHub shorthands, dist-tags like <code>latest</code>, local paths and <code>npm:</code> aliases.
          </p>
          <p>
            Semantic Versions writes these rules down as part of the <a href="/spec/#ranges">specification</a>, with a{" "}
            <a href="/grammar/">grammar</a> and a shared{" "}
            <a href="https://github.com/vltpkg/semantic-versions/tree/main/conformance" target="_blank" rel="noopener">
              conformance suite
            </a>
            , so a range means the same thing in every tool that implements it.
          </p>
          <h3 id="official-standard">Isn’t semver.org an official standard?</h3>
          <p>
            It is a widely adopted document rather than a standard in the formal sense. Semantic Versioning was written
            by Tom Preston-Werner, announced in December 2009, and is published on a website under CC BY 3.0. It has not
            gone through a standards body such as the IETF, ECMA or ISO. Version 2.0.0 was released in June 2013, and it
            is still the current version.
          </p>
          <p>
            It does have stewards. In 2019 its long-time maintainer handed it to a group of maintainers from package
            managers that use it (npm, Bundler, Cargo, Composer, NuGet, CocoaPods and others), who adopted an RFC
            process. Under that process a change counts as adopted only once the maintainers approve it and a majority
            of their implementations ship it, and changes that would significantly break any of those communities are
            ruled out. That makes the spec stable, which matters, but it also means the definitions tools needed and
            invented for themselves (ranges, pre-release matching, what a build is for) were never brought into it.
          </p>
          <p>
            Ranges are the clearest example. The range syntax most people know comes from{" "}
            <a href="https://github.com/npm/node-semver" target="_blank" rel="noopener">
              node-semver
            </a>
            , which Isaac Z. Schlueter wrote for npm in 2011. In 2020 he proposed adding a ranges specification to
            Semantic Versioning (
            <a href="https://github.com/semver/semver/pull/584" target="_blank" rel="noopener">
              semver/semver#584
            </a>
            ). Maintainers of other package managers pointed out where their tools differ and that aligning them would
            break existing constraints; the proposal is still open. Much of the range grammar in Semantic Versions
            descends from that work, extended with pre-release and build channels, wildcards and contexts. The{" "}
            <a href="/origin/">history</a> has the timeline.
          </p>
          <p>
            Semantic Versions does not try to replace that process. It is a separate, versioned specification that keeps
            every Semantic Versioning 2.0.0 version valid and adds the missing parts in the open, at{" "}
            <a href="https://github.com/vltpkg/semantic-versions" target="_blank" rel="noopener">
              vltpkg/semantic-versions
            </a>
            .
          </p>
          <h3 id="same-everywhere">Doesn’t every package manager read versions the same way?</h3>
          <p>
            They agree on the shape of a version and disagree on almost everything around it. A few examples, each from
            the tool’s own documentation:
          </p>
          <ul>
            <li>
              <strong>A bare version.</strong> In npm, <code>1.2.3</code> means exactly that version. In Cargo,{" "}
              <code>1.2.3</code> is a caret requirement and means <code>&gt;=1.2.3, &lt;2.0.0</code>.
            </li>
            <li>
              <strong>
                The <code>v</code> prefix.
              </strong>{" "}
              Semantic Versioning 2.0.0 says <code>v1.2.3</code> is not a semantic version. Go modules require it (
              <code>v1.2.3</code>), while node-semver strips it and accepts the rest.
            </li>
            <li>
              <strong>Builds.</strong> Semantic Versioning 2.0.0 says build metadata MUST be ignored for precedence, so{" "}
              <code>1.0.0+linux</code> and <code>1.0.0+windows</code> are “equal”. Go ignores the suffix when comparing
              versions, and node-semver drops it when it normalizes one. Two different artifacts end up
              indistinguishable to the resolver.
            </li>
            <li>
              <strong>Range syntax.</strong> npm separates comparators with spaces and alternatives with <code>||</code>
              ; Cargo separates comparators with commas and has no <code>||</code>; Python’s{" "}
              <a href="#pep-440">PEP 440</a> uses <code>~=</code> and <code>==1.4.*</code>; Composer and RubyGems each
              have their own.
            </li>
          </ul>
          <p>
            Each choice is defensible on its own. Together they mean that “semver” names a family of dialects, and that
            the same version or range can resolve differently depending on which tool reads it. That is the gap Semantic
            Versions closes: one definition of versions, precedence (builds included), sets, ranges and comparators,
            with <a href="/libraries/">implementations in eight languages</a> that give identical answers. For how
            builds lost their meaning in the first place, see <a href="#semver-org">how this differs from semver.org</a>
            .
          </p>
          <h2 id="the-specification">The specification</h2>
          <h3 id="semver-org">
            How does this differ from <code>semver.org</code>?
          </h3>
          <p>
            Semantic Versions is a spiritual successor to{" "}
            <a href="https://semver.org/spec/v2.0.0-rc.1.html">Semantic Versioning 2.0.0-rc.1</a>, the draft that
            introduced optional pre-release and build versions. The next draft, <code>2.0.0-rc.2</code>, turned builds
            into inert “build metadata,” which made them semantically useless. Semantic Versions reverts that change, so{" "}
            <strong>builds participate in precedence</strong> again, and adds the definitions tools were already relying
            on without a spec: <strong>sets, ranges, operators and comparators</strong>.
          </p>
          <p>
            Anything valid under Semantic Versioning 2.0.0 is valid here and parses identically. The topic-by-topic
            comparison is on the <a href="/proposal/#compare">proposal page</a>, and the <a href="/origin/">history</a>{" "}
            traces how builds lost their meaning.
          </p>
          <h3 id="reset-to-zero">
            Why <strong>MUST</strong> minor and patch reset to <code>0</code>?
          </h3>
          <p>
            Resetting keeps versions a single, well-defined total order and gives every line an unambiguous first
            member: <code>2.5.0</code> is the start of the <code>2.5</code> series, and <code>2.0.0</code> is the start
            of the <code>2.x</code> series. Tools that reason about “the first release of a minor” or that desugar
            ranges (<code>~</code>, <code>^</code>, <code>~&gt;</code>) rely on this. A carried-forward counter like{" "}
            <code>2.5.1</code> with no <code>2.5.0</code> breaks that assumption.
          </p>
          <p>
            The rule constrains <em>carrying a lower-position counter forward</em>, not <em>skipping numbers</em>. You{" "}
            <strong>MAY</strong> skip values: <code>2.4.10</code> → <code>2.6.0</code> → <code>4.0.0</code> is fine,
            because each increment still starts its lower positions at <code>0</code>. What the rule forbids is{" "}
            <code>2.4.10</code> → <code>2.5.1</code>: the minor incremented, so patch <strong>MUST</strong> restart at{" "}
            <code>0</code>.
          </p>
          <p>
            This is also why Semantic Versions keeps <strong>MUST</strong> rather than relaxing it to{" "}
            <strong>SHOULD</strong> (as proposed in{" "}
            <a href="https://github.com/semver/semver/pull/393" target="_blank" rel="noopener">
              semver/semver#393
            </a>
            ). A normative relaxation would fragment the ordering guarantees that existing Semantic Versioning 2.0.0
            tooling depends on, for a gain you can already have by skipping the numbers you don't want.
          </p>
          <h3 id="position-names">
            Why keep <code>MAJOR.MINOR.PATCH</code> instead of renaming to <code>BREAKING.FEATURE.FIX</code>?
          </h3>
          <p>
            Backward compatibility is the whole pitch. Anything valid under Semantic Versioning 2.0.0 stays valid here,
            and <code>MAJOR.MINOR.PATCH</code> is the vocabulary the ecosystem already speaks: parsers, registries,
            changelog tools and a decade of habit. Renaming the positions would fragment all of that for a purely
            cosmetic gain, so the names stay.
          </p>
          <p>
            The confusion the renaming proposals react to is real, though, and worth stating plainly:{" "}
            <strong>
              an increment reflects the <em>nature</em> of the change to your public API (incompatible, additive, or a
              fix), not the <em>amount</em> of code that changed.
            </strong>{" "}
            A complete internal rewrite that leaves the public API untouched is still a patch; a one-character change
            that removes a parameter is a major bump. The number you increment is decided by what the change does to the
            contract, never by how much work it was.
          </p>
          <p>
            To keep that meaning attached to the familiar labels, the spec states the intent next to each name:{" "}
            <code>MAJOR</code> is an incompatible change, <code>MINOR</code> an additive change, <code>PATCH</code> a
            fix. And a patch is exactly that, <em>a fix</em>, not a promise of backward compatibility (nothing can truly
            guarantee that).
          </p>
          <h3 id="public-api">What counts as the “public API”, and is Semantic Versions for apps and products?</h3>
          <p>
            “Public API” is meant <strong>broadly</strong>: it is whatever public interface or contract you declare.
            That might be a library's function signatures, a CLI's flags and output, a GUI's documented behaviour, a
            wire protocol or a file format. The spec does not care which kind of interface it is; it only requires that
            you <strong>declare one</strong> and increment based on changes to it. If your software's contract is its
            command-line surface, that surface <em>is</em> your public API for versioning purposes.
          </p>
          <p>
            What a version is <em>about</em> is named by its <a href="/spec/#context">context</a>:{" "}
            <code>source:name@version</code> (for example <code>npm:react@18.2.0</code>) identifies a specific artifact
            in a specific ecosystem, the thing whose interface you are versioning, rather than leaving a bare{" "}
            <code>1.2.3</code> to mean whatever the reader assumes.
          </p>
          <p>
            Because of that, Semantic Versions targets a <strong>declared interface</strong>, not a product's marketing,
            feature set or billing cadence. A “product version” that jumps to <code>2.0.0</code> for a licensing change,
            or that must land features on a planned <code>1.5.0</code>, follows a different scheme, one where the number
            communicates roadmap or pricing rather than interface compatibility. That is a legitimate thing to want, but
            it is not what a semantic version measures. If you need both, version the declared interface semantically
            and give the product its own separate label.
          </p>
          <h3 id="deprecated">What does the spec mean by “deprecated”?</h3>
          <p>
            Deprecation is a <strong>documentation and registry concern, not version syntax</strong>. The spec
            references it once (a minor <strong>MUST</strong> be incremented when public API functionality is marked as
            deprecated) and deliberately defines no notation for it. None is planned.
          </p>
          <p>
            The reason is that deprecation is <em>retroactive</em> while a version string is not. You deprecate{" "}
            <code>1.2.3</code> after publishing it, often long after, and registries model this as mutable metadata
            attached to an already-published version. But the contents of a released version <strong>MUST NOT</strong>{" "}
            be modified, and its version string is fixed at publish time. There is no moment at which the string could
            be rewritten to record a decision made later.
          </p>
          <p>
            Encoding it anyway would break precedence in both available slots. A pre-release lowers precedence and
            announces instability, which is not what a deprecation says: a deprecated release is usually stable, just
            unwanted. A build is worse. Because a build <a href="/spec/#precedence">participates in precedence</a> here,{" "}
            <code>1.2.3+deprecated</code> would sort <em>above</em> <code>1.2.3</code> and be preferred by every range
            that matched it. The deprecated release would win, which is precisely backwards.
          </p>
          <p>
            So mark deprecations in your documentation and in your registry's metadata, and ship the announcement in a
            minor release. A version number records what changed in the declared interface; it does not carry advice
            about whether to use a release. That advice is real and worth publishing; it simply belongs somewhere
            mutable.
          </p>
          <h2 id="ecosystem">Ecosystem</h2>
          <h3 id="purl">
            Do I still need Package-URL (<code>purl</code>)?
          </h3>
          <p>
            For most uses, no. A source-qualified <a href="/spec/#context">context</a> already identifies a package
            version across ecosystems: <code>npm:react@18.2.0</code> names the same thing as{" "}
            <code>pkg:npm/react@18.2.0</code>. The difference is what comes with it. A <code>purl</code> is only an
            identifier: it says nothing about how versions order or match, and leaves ranges to a separate syntax (
            <a
              href="https://github.com/package-url/purl-spec/blob/main/VERSION-RANGE-SPEC.rst"
              target="_blank"
              rel="noopener"
            >
              <code>vers</code>
            </a>
            ). A Semantic Versions reference carries its semantics with it: precedence (builds included), sets, ranges
            and comparators, defined once and shared by every ecosystem.
          </p>
          <p>
            The rest of a <code>purl</code> has a place here too. Platform and distribution qualifiers (
            <code>?arch=…&amp;os=…</code>) sit outside a <code>purl</code>’s version, so nothing can order or select by
            them; as <a href="/extensions/variants/">Build Variants</a> they live in the build, where ranges can select
            them. An origin other than the public registry is just another source (<code>internal:billing@2.4.0</code>).
          </p>
          <p>
            Where a tool or SBOM format still asks for a <code>purl</code>, converting is mechanical:{" "}
            <code>source:name@version</code> becomes <code>pkg:source/name@version</code>, with an npm scope or Maven
            group moving into its namespace segment (<code>npm:@vue/cli@5.0.8</code> becomes{" "}
            <code>pkg:npm/%40vue/cli@5.0.8</code>). Using the familiar ecosystem tokens as sources (<code>npm</code>,{" "}
            <code>pypi</code>, <code>gem</code>, <code>cargo</code>, <code>golang</code>, <code>maven</code>,{" "}
            <code>nuget</code>, <code>composer</code>, <code>oci</code>) keeps that conversion one-to-one.
          </p>
          <h3 id="pep-440">How does it work with Python’s PEP 440?</h3>
          <p>
            <a href="https://peps.python.org/pep-0440/" target="_blank" rel="noopener">
              PEP 440
            </a>{" "}
            is the other widely used version grammar, and it <em>recommends</em> Semantic Versioning for the public
            release segment. Because Semantic Versions restores the two things Semantic Versioning 2.0.0 discarded,{" "}
            <strong>build precedence</strong> and <strong>default pre-release exclusion</strong>, it lines up with PEP
            440’s ordering model more closely than 2.0.0 does. What follows is the interoperable subset; it adds no
            grammar or precedence rules to the specification.
          </p>
          <h4>Compatible subset</h4>
          <p>A version round-trips between the two schemes when it stays within this subset:</p>
          <ol>
            <li>
              The release segment is exactly three components (<code>MAJOR.MINOR.PATCH</code>) with no leading zeroes.
              PEP 440 permits an arbitrary-length release segment, but recommends this form.
            </li>
            <li>
              Pre-releases use the spellings <code>-a.N</code> (alpha), <code>-b.N</code> (beta) and <code>-rc.N</code>{" "}
              (release candidate). These sort correctly under Semantic Versions precedence (
              <code>a &lt; b &lt; rc</code>, then numerically), and map onto PEP 440’s normalized <code>aN</code> /{" "}
              <code>bN</code> / <code>rcN</code> pre-release segments.
            </li>
          </ol>
          <h4>Ordering alignment</h4>
          <ul>
            <li>
              <strong>Local versions ↔ builds.</strong> PEP 440 local versions (<code>1.0.0+abc</code>) participate in
              ordering and rank a labelled artifact above its plain release. Semantic Versions’ restored{" "}
              <a href="/spec/#precedence">build precedence</a> does the same (<code>1.0.0 &lt; 1.0.0+build</code>),
              where Semantic Versioning 2.0.0 discards it.
            </li>
            <li>
              <strong>Default pre-release exclusion.</strong> A range of stable comparators admits no pre-releases
              unless it opts in (see <a href="/spec/#pre-release-channels">pre-release channels</a>), mirroring{" "}
              <code>pip</code>’s requirement of <code>--pre</code>.
            </li>
            <li>
              <strong>Post-releases.</strong> PEP 440 post-releases (<code>1.0.0.post1</code>) rank <em>above</em> the
              release, matching the “refinement above the release” shape of build precedence, though the two are not
              byte-for-byte convertible (see below).
            </li>
          </ul>
          <h4>Specifier mapping</h4>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>PEP 440 specifier</th>
                  <th>Semantic Versions range</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>~=1.4.2</code>
                  </td>
                  <td>
                    <code>~1.4.2</code> (<code>&gt;=1.4.2 &lt;1.5.0-0</code>)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>~=1.4</code>
                  </td>
                  <td>
                    <code>^1.4</code> (<code>&gt;=1.4.0 &lt;2.0.0-0</code>)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>==1.4.*</code>
                  </td>
                  <td>
                    <code>1.4.x</code> (<code>&gt;=1.4.0 &lt;1.5.0-0</code>)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>&gt;=1.4.2</code>, <code>&gt;1.4.2</code>, <code>&lt;=1.4.2</code>, <code>&lt;1.4.2</code>
                  </td>
                  <td>same operator, identical meaning</td>
                </tr>
                <tr>
                  <td>
                    <code>==1.4.2</code>
                  </td>
                  <td>
                    <code>1.4.2</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <h4>Not representable</h4>
          <p>
            These PEP 440 constructs have no Semantic Versions equivalent and are deliberately left unmapped rather than
            special-cased:
          </p>
          <ul>
            <li>
              <strong>Epochs</strong> (<code>1!1.0</code>): an epoch cannot be encoded without breaking Semantic
              Versioning 2.0.0 compatibility.
            </li>
            <li>
              <strong>Development releases</strong> (<code>.devN</code>): PEP 440 sorts a dev release <em>below</em> its
              own parent pre-release (<code>1.0.0-a.1.dev.1 &lt; 1.0.0-a.1</code>), which contradicts the rule that a
              larger set of identifiers ranks <em>higher</em>.
            </li>
            <li>
              <strong>Exact post-release numerics</strong> (<code>.postN</code>): the “above the release” concept maps
              onto build precedence, but the precise <code>.postN</code> counter semantics do not survive the round
              trip.
            </li>
          </ul>
          <h2 id="the-project">The project</h2>
          <h3 id="grammar">Where is the grammar?</h3>
          <p>
            Backus–Naur forms for <a href="/grammar/#versions">versions</a>, <a href="/grammar/#ranges">ranges</a> and{" "}
            <a href="/grammar/#comparators">comparators</a> are published on the <a href="/grammar/">grammar page</a>,
            alongside the reference parser,{" "}
            <a
              href="https://github.com/vltpkg/semantic-versions/tree/main/libraries/javascript"
              target="_blank"
              rel="noopener"
            >
              <code>semantic-versions</code>
            </a>
            . For quick validation there is also a{" "}
            <a href="https://regex101.com/r/vkijKf/1/" target="_blank" rel="noopener">
              regular expression
            </a>
            , and you can <a href="/selector/">try ranges</a> against the parser in your browser.
          </p>
          <p>
            Ports of the parser for Rust, Python, Go, Ruby, Java, .NET and PHP pass the same conformance suite; they are
            listed, with benchmarks, on the <a href="/libraries/">libraries page</a>.
          </p>
          <h3 id="contributing">Can I contribute, or propose an extension?</h3>
          <p>
            Yes. The specification, reference parser and extensions are developed in the open at{" "}
            <a href="https://github.com/vltpkg/semantic-versions" target="_blank" rel="noopener">
              vltpkg/semantic-versions
            </a>
            . Open an issue or discussion to propose a change, report a defect, or float a new extension. Anything that
            rides on a source-qualified version and restored build precedence is in scope.
          </p>
          <h3 id="license">How is it licensed?</h3>
          <p>
            The specification text is licensed under{" "}
            <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">
              CC BY 3.0
            </a>
            , the reference parser under Apache 2.0. See the <a href="/license/">license page</a> for details and
            attribution.
          </p>
        </article>
      </div>
    </main>
  );
}
