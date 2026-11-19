# frozen_string_literal: true

# Kept in its own file so the gemspec can read it without loading the library,
# which needs Ruby 3.1 (builds then work on any Ruby, including macOS's).
module SemanticVersions
  VERSION = "1.0.0"
end
