**Title:** [BUG] A user-level `registries.*` alias is written into the project lockfile, which then fails `--frozen-lockfile` on machines without it

### 📋 Bug Description

`vlt install` merges the user config's `registries` into the project's config and writes the merged map into `vlt-lock.json` `options.registries`, even when no node in the graph resolves through the added alias. The lockfile then depends on the machine that wrote it: on any machine without that user config (CI, a colleague), `vlt install --frozen-lockfile` fails with "Configuration options have changed".

### ✅ Expected Behavior

Either of these would keep the lockfile machine-independent:

- `options.registries` in the lockfile records only the project's own config (`vlt.json`), not user-level config; or
- it records only the aliases that some node or edge in the graph actually uses.

A user-level alias that nothing resolves through should not change the lockfile, and a frozen install should not fail over an alias that no node uses.

### ❌ Actual Behavior

The alias is added to `options.registries` on an ordinary install (nodes and edges unchanged), and a frozen install elsewhere refuses the lockfile:

```
Error: Lockfile is out of sync with package.json. Run "vlt install" to update.
  Configuration options have changed:
    registries: main "https://registry.vlt.io/vltpkg/main/" -> (removed)
```

### 🔄 Steps to Reproduce

Project config pins only npm:

```json
// vlt.json
{ "config": { "registries": { "npm": "https://registry.npmjs.org/" } } }
```

```sh
# 1. Add a user-level alias that the project never references
vlt config set registries.main=https://registry.vlt.io/vltpkg/main/ --config=user
vlt config get registries          # { main: ..., npm: ... }  (merged)

# 2. Ordinary install: the alias lands in the lockfile
vlt install
# vlt-lock.json options.registries is now { npm: ..., main: ... }; nodes/edges unchanged

# 3. Simulate CI / another machine
vlt config del registries.main --config=user
rm -rf node_modules
vlt install --frozen-lockfile
# -> "Configuration options have changed: registries: main ... -> (removed)"
```

Verified with vlt 1.8.1 on Linux (Node 22) and macOS (Node 24). Repo where this bit us: https://github.com/vltpkg/semantic-versions (CI runs `vlt install --frozen-lockfile`; a local `vlt install` on a machine with a user-level alias keeps re-adding `main` to the lockfile).

### 🌍 Environment

- vlt: 1.8.1
- Node: 22.23.5 (Linux x64), 24.18.0 (macOS arm64)

### 🛠️ Workaround

`git checkout vlt-lock.json` after every local install, or remove the alias from user config. Neither is discoverable from the error, which points at `package.json`.

### 📎 Additional Context

Related but different: #1579 is about a *changed* registry not re-resolving nodes. This one is about an *unused* alias changing the lockfile at all.
