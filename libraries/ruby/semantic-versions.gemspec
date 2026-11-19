# frozen_string_literal: true

require_relative "lib/semantic_versions/version"

Gem::Specification.new do |spec|
  spec.name = "semantic-versions"
  spec.version = SemanticVersions::VERSION
  spec.authors = ["vlt technology inc."]
  spec.summary = "Parse, compare and match versions per the Semantic Versions specification (semver.xyz)"
  spec.description = "A port of the semantic-versions reference implementation: strict parsing, " \
                     "build precedence, pre-release and build channels, contexts and npm-style ranges."
  spec.homepage = "https://semver.xyz/libraries/#ruby"
  spec.license = "Apache-2.0"
  spec.required_ruby_version = ">= 3.1"
  spec.metadata = {
    "source_code_uri" => "https://github.com/vltpkg/semantic-versions/tree/main/libraries/ruby",
    "documentation_uri" => "https://semver.xyz/spec/",
    "rubygems_mfa_required" => "true"
  }
  spec.files = Dir["lib/**/*.rb", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]
end
