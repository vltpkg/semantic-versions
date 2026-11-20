import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "History: a short history of Semantic Versioning · semver.xyz",
  alternates: { canonical: "/origin/" },
  description:
    "A short history of Semantic Versioning, from semver.org in 2009 to today: how builds were introduced in 2.0.0-rc.1, how 2.0.0-rc.2 turned them into inert build metadata, and what has and hasn't changed since.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function Page() {
  return (
    <main>
      <section className="page-hero reveal">
        <p className="eyebrow">History</p>
        <h1>
          A short history of <span className="grad">Semantic Versioning</span>.
        </h1>
        <p className="lead">
          Semantic Versioning is well intentioned, but it carries a few bad definitions and a few missing ones. The most
          consequential mistake happened between two release candidates in 2013, and we still live with it today. Here
          is the paper trail, from the first commit of semver.org to the proposal that never landed.
        </p>
      </section>
      <section className="timeline">
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Dec 2009 · semver.org · @mojombo</div>
          <h3>Versioning gets a name</h3>
          <p>
            Tom Preston-Werner, a cofounder of GitHub, publishes Semantic Versioning: a name, a specification and a URL
            for the <code>MAJOR.MINOR.PATCH</code> convention many projects already followed loosely. The pitch is
            dependency hell: with a public API declared and the three numbers meaning what they say, a consumer can
            state what it needs and a tool can resolve it. The CommonJS group is discussing whether to require it the
            same day. Within days it has “special versions” (<code>1.0.0beta1</code>), the ancestor of pre-releases.
          </p>
          <p>
            <a href="https://github.com/semver/semver.org/commit/ca64580" target="_blank" rel="noopener">
              semver.org@ca64580 — “First commit”
            </a>{" "}
            ·{" "}
            <a href="https://semver.org/spec/v0.9.0.html" target="_blank" rel="noopener">
              semver.org/spec/v0.9.0.html
            </a>
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Jan 2010 · npm · @isaacs</div>
          <h3>npm makes it the rule</h3>
          <p>
            npm arrives, adopts Semantic Versioning for package versions from the start, and nests{" "}
            <code>node_modules</code>, so conflicting transitive dependencies can be installed side by side instead of
            fighting over one slot. JavaScript sidesteps the first circle of dependency hell that trapped single-version
            ecosystems, and the registry goes on to hold more packages than anywhere else. Every one of them is
            versioned by this spec, which makes npm the spec’s largest test, and the place its gaps show first.
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Feb 2011 · node-semver · @isaacs</div>
          <h3>npm writes down how to match versions</h3>
          <p>
            Isaac Z. Schlueter publishes the <code>semver</code> package for npm. Over the following years it defines
            what the spec never did: comparators, x-ranges, tilde, caret and hyphen ranges, <code>||</code>, a rule for
            when pre-releases match, and a published Backus–Naur grammar for ranges. Every <code>^1.2.3</code> in a{" "}
            <code>package.json</code> is written in its language, and much of the range grammar in{" "}
            <strong>Semantic Versions</strong> descends from it.
          </p>
          <p>
            <a href="https://github.com/npm/node-semver" target="_blank" rel="noopener">
              npm/node-semver
            </a>
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Mar–Jun 2011 · 1.0.0</div>
          <h3>1.0.0, and pre-releases get their dash</h3>
          <p>
            The document becomes <strong>Semantic Versioning 1.0.0</strong>. Special versions are renamed pre-releases,
            and in June they get the dash that every parser now expects: <code>1.0.0-alpha1</code> rather than{" "}
            <code>1.0.0alpha1</code>. Precedence is still “lexicographic ASCII sort order”, which is why{" "}
            <code>1.0.0-beta11</code> would sort before <code>1.0.0-beta2</code>; the dotted identifiers that fix that
            are still a few months away.
          </p>
          <p>
            <a href="https://semver.org/spec/v1.0.0.html" target="_blank" rel="noopener">
              semver.org/spec/v1.0.0.html
            </a>{" "}
            ·{" "}
            <a href="https://github.com/semver/semver/commit/05a00df" target="_blank" rel="noopener">
              semver@05a00df — “Delimit pre-release versions by dash”
            </a>
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Nov 2011 · @mojombo</div>
          <h3>Builds are introduced</h3>
          <p>
            Tom Preston-Werner adds <em>build versions</em> to the spec. A build functions as the antithesis of a
            pre-release (you could call it a post-release) and it <strong>participates in precedence</strong>. Two
            builds of the same normal version can be ordered.
          </p>
          <p>
            <a
              href="https://github.com/semver/semver/commit/70921127564efdb54263de3243a7cb279d020d2a"
              target="_blank"
              rel="noopener"
            >
              semver@7092112 — "add build versions"
            </a>
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Dec 2011 · 2.0.0-rc.1</div>
          <h3>The high-water mark</h3>
          <p>
            <code>2.0.0-rc.1</code> is published. As far as we can tell it is the most accurate versioning spec to date:
            it encompasses common practice of generating builds and build variants, and keeps their precedence intact.
            This is the document <strong>Semantic Versions</strong> takes as its starting point.
          </p>
          <p>
            <a href="https://semver.org/spec/v2.0.0-rc.1.html" target="_blank" rel="noopener">
              semver.org/spec/v2.0.0-rc.1.html
            </a>
          </p>
        </div>
        <div className="tl-item bad reveal">
          <span className="tl-dot" /> <div className="tl-date">Mar 2013 · 2.0.0-rc.2 · @haacked &amp; @jeffhandley</div>
          <h3>Builds become inert "build metadata"</h3>
          <p>
            Two years later, Phil Haack and Jeff Handley, contributors from the NuGet and .NET ecosystem, redefine
            builds as <em>build metadata</em> and strip away their precedence. Overnight, every version with build
            metadata becomes equivalent to any other of the same normal or pre-release version. Six artifacts with
            different git hashes and architectures are now <em>semantically identical</em>, with no way in the spec to
            order or choose between them. <a href="#the-exact-change">See the exact wording that changed ↓</a>
          </p>
          <p>
            <a href="https://www.diffchecker.com/UFodzNqy/" target="_blank" rel="noopener">
              rc.1 → rc.2 diff
            </a>{" "}
            ·{" "}
            <a href="https://github.com/semver/semver/pull/77" target="_blank" rel="noopener">
              semver/semver#77
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/semver/semver/commit/57fd19400f53b5d4559de4dcf6ede2e638250625"
              target="_blank"
              rel="noopener"
            >
              57fd194
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/semver/semver/commit/13aaadaadb0d572b59c84a9851540ed1caeea35f"
              target="_blank"
              rel="noopener"
            >
              13aaada
            </a>
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Jun 2013 · 2.0.0</div>
          <h3>2.0.0 is final. Then nothing.</h3>
          <p>
            <code>2.0.0</code> is published on 18 June 2013 with rc.2’s definitions intact: build metadata is ignored
            for precedence, and the spec still says nothing about ranges. It is the version every package manager cites
            today. In the years since, the document has gained a grammar, a regex and translations, but no change to
            what a version means, and no successor has been published.
          </p>
          <p>
            <a href="https://semver.org/spec/v2.0.0.html" target="_blank" rel="noopener">
              semver.org/spec/v2.0.0.html
            </a>
          </p>
        </div>
        <div className="tl-item bad reveal">
          <span className="tl-dot" /> <div className="tl-date">Since 2013</div>
          <h3>npm forgets builds exist</h3>
          <p>
            npm's own SemVer implementation, which itself adds grammars and logic on top of the spec, defaults to{" "}
            <strong>stripping build metadata</strong> from versions. The result: there are effectively no packages in
            the registry carrying build metadata, even though it is supposed to be a valid part of a version. A
            legitimate, useful concept was co-opted into a non-functional one, confusing tooling authors ever since.
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Jun 2020 · semver/semver#584 · @isaacs</div>
          <h3>Ranges are proposed upstream, and stall</h3>
          <p>
            Isaac proposes a specification for ranges to Semantic Versioning itself: a draft of about 380 lines covering
            comparators, caret, tilde, x-ranges, hyphen ranges, <code>||</code> and node-semver’s pre-release rule.
            Maintainers from Cargo, Composer, RubyGems, Bundler and CocoaPods point out where their tools behave
            differently, and that aligning them would break constraints already in the wild. After 79 comments the pull
            request is still open, and the spec still has no ranges.
          </p>
          <p>
            <a href="https://github.com/semver/semver/pull/584" target="_blank" rel="noopener">
              semver/semver#584
            </a>
          </p>
        </div>
        <div className="tl-item reveal">
          <span className="tl-dot" /> <div className="tl-date">Today · 1.0.0</div>
          <h3>Semantic Versions</h3>
          <p>
            <a href="/spec/">Semantic Versions</a> reverts the build change, restores build precedence, corrects the
            definition of a patch, and finally writes down the sets, ranges and comparators the ecosystem already relies
            on, building on node-semver’s grammar and extending it with channels, wildcards and contexts. If we want to
            avoid becoming heretics in the sixth circle, we have to codify what we actually do. It is also{" "}
            <a href="/proposal/">written to become Semantic Versioning 3.0.0</a>, the successor <code>2.0.0</code> never
            got, if there is enough interest in taking it upstream.
          </p>
        </div>
      </section>
      <section className="wrap origin-diff">
        <div className="section-head left reveal">
          <p className="eyebrow">The exact change</p>
          <h2 id="the-exact-change" className="section-title big">
            Two sentences, a decade of confusion.
          </h2>
          <p className="lead">
            The intent of the <code>+</code> build was never in doubt in <code>2.0.0-rc.1</code>: a build was a{" "}
            <em>post-release</em> that ordered above its normal version. Between the two release candidates, the
            sentence that gave it meaning was struck and replaced. Here is that change, as a diff of the verbatim spec
            text.
          </p>
        </div>
        <div className="gh-diff reveal">
          <div className="gh-diff-head">
            <span className="gh-diff-file">
              SEMVER.md <span className="gh-diff-rev">2.0.0-rc.1 → 2.0.0-rc.2</span>
            </span>{" "}
            <span className="gh-diff-stat">
              <span className="gh-add">+6</span>
              <span className="gh-del">−5</span>
            </span>
          </div>
          <div className="gh-diff-body">
            <div className="gh-hunk">
              <span className="gh-hunk-at">@@ -33,3 +31,4 @@</span> Build definition
            </div>
            <div className="gh-row del">
              <span className="ln ln-old">33</span>
              <span className="ln ln-new" />
              <span className="gh-sign">-</span>
              <span className="gh-code">
                A <b>build version</b> MAY be denoted by appending a plus sign …
              </span>
            </div>
            <div className="gh-row del">
              <span className="ln ln-old">34</span>
              <span className="ln ln-new" />
              <span className="gh-sign">-</span>
              <span className="gh-code">
                <mark>Build versions satisfy and have a higher precedence than the associated normal version.</mark>
              </span>
            </div>
            <div className="gh-row del">
              <span className="ln ln-old">35</span>
              <span className="ln ln-new" />
              <span className="gh-sign">-</span>
              <span className="gh-code">
                Examples: <code>1.0.0+build.1</code>, <code>1.3.7+build.11.e0f985a</code>
              </span>
            </div>
            <div className="gh-row add">
              <span className="ln ln-old" />
              <span className="ln ln-new">31</span>
              <span className="gh-sign">+</span>
              <span className="gh-code">
                <b>Build metadata</b> MAY be denoted by appending a plus sign …
              </span>
            </div>
            <div className="gh-row add">
              <span className="ln ln-old" />
              <span className="ln ln-new">32</span>
              <span className="gh-sign">+</span>
              <span className="gh-code">
                <mark>Build metadata SHOULD be ignored when determining version precedence.</mark>
              </span>
            </div>
            <div className="gh-row add">
              <span className="ln ln-old" />
              <span className="ln ln-new">33</span>
              <span className="gh-sign">+</span>
              <span className="gh-code">
                <mark>
                  Thus two packages with the same version but different build metadata are considered to be the same
                  version.
                </mark>
              </span>
            </div>
            <div className="gh-row add">
              <span className="ln ln-old" />
              <span className="ln ln-new">34</span>
              <span className="gh-sign">+</span>
              <span className="gh-code">
                Examples: <code>1.0.0-alpha+001</code>, <code>1.0.0+20130313144700</code>
              </span>
            </div>
            <div className="gh-hunk">
              <span className="gh-hunk-at">@@ -40,2 +38,2 @@</span> Precedence
            </div>
            <div className="gh-row del">
              <span className="ln ln-old">40</span>
              <span className="ln ln-new" />
              <span className="gh-sign">-</span>
              <span className="gh-code">
                Precedence MUST be calculated by separating the version into major, minor, patch, pre-release,{" "}
                <mark>and build</mark> identifiers in that order. …
              </span>
            </div>
            <div className="gh-row del">
              <span className="ln ln-old">41</span>
              <span className="ln ln-new" />
              <span className="gh-sign">-</span>
              <span className="gh-code">
                <mark>
                  Pre-release and build version precedence MUST be determined by comparing each dot separated
                  identifier.
                </mark>
              </span>
            </div>
            <div className="gh-row add">
              <span className="ln ln-old" />
              <span className="ln ln-new">38</span>
              <span className="gh-sign">+</span>
              <span className="gh-code">
                Precedence MUST be calculated by separating the version into major, minor, patch and pre-release
                identifiers in that order.
              </span>
            </div>
            <div className="gh-row add">
              <span className="ln ln-old" />
              <span className="ln ln-new">39</span>
              <span className="gh-sign">+</span>
              <span className="gh-code">
                <mark>(Build metadata does not figure into precedence.)</mark> …
              </span>
            </div>
          </div>
        </div>
        <p className="diff-source reveal">
          See the full side-by-side:{" "}
          <a href="https://www.diffchecker.com/UFodzNqy/" target="_blank" rel="noopener">
            rc.1 → rc.2 diff
          </a>{" "}
          ·{" "}
          <a href="https://semver.org/spec/v2.0.0-rc.1.html" target="_blank" rel="noopener">
            rc.1 text
          </a>{" "}
          ·{" "}
          <a href="https://semver.org/spec/v2.0.0-rc.2.html" target="_blank" rel="noopener">
            rc.2 text
          </a>
        </p>
        <div className="diff-why reveal">
          <h3>Why they did it, and the opening it left</h3>
          <p>
            It wasn't malice; it answered a real need. NuGet was designing its v3 feed and wanted build metadata to be{" "}
            <strong>diagnostic only</strong>: a commit hash, date, or build number that never changes a package's
            identity. If build affected precedence, then <code>1.0.0+a</code> and <code>1.0.0+b</code> would be{" "}
            <em>different</em> packages: ambiguous equality, duplicate registry entries, and unpredictable folder paths,
            URLs and <code>.nupkg</code> filenames that NuGet constructs from the <em>normalized</em> version. Declaring
            build “ignored” made identity deterministic. That local win became the global default, and npm's own SemVer,
            which strips build, sealed it.
          </p>
          <p>
            The irony is the opportunity. Because the ecosystem then stopped using build <em>at all</em>, the slot is
            empty real estate. Semantic Versions restores its precedence and puts it to work exactly where nothing else
            lives: <a href="/extensions/variants/">Build Variants</a>,{" "}
            <a href="/extensions/integrity/">Package Integrity</a> and{" "}
            <a href="/extensions/dependency-locks/">Dependency Locks</a> are what a meaningful build was always for.
          </p>
          <p className="diff-why-src">
            Reasoning drawn from{" "}
            <a href="https://devblogs.microsoft.com/dotnet/supporting-semver-2-0-0/" target="_blank" rel="noopener">
              “Supporting Semantic Versioning 2.0.0” (.NET Blog)
            </a>{" "}
            and the{" "}
            <a href="https://github.com/NuGet/Home/wiki/SemVer-2.0.0-support" target="_blank" rel="noopener">
              NuGet SemVer 2.0.0 support
            </a>{" "}
            notes.
          </p>
        </div>
      </section>
    </main>
  );
}
