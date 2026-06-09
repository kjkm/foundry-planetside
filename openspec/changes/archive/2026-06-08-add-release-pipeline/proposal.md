## Why

The module can only be installed by hand-copying the folder into `Data/modules/`. The production server is awkward to transfer files to manually, and every other Foundry module the user runs installs via a manifest URL with in-app update detection. Adopting the standard GitHub-Releases distribution route gives a normal "Install via Manifest URL" deploy and automatic update checks.

## What Changes

- Add a tag-driven GitHub Actions workflow (`.github/workflows/release.yml`) that, on pushing a `v*` tag, builds and publishes a GitHub Release with `module.json` and `module.zip` attached as assets.
- The workflow runs `npm ci` so `setup.js` vendors `scripts/vendor/three.module.js` into the zip — the runtime dependency is **not** committed (it is `.gitignore`'d), so a plain source archive would ship a broken module.
- The workflow writes the release version and URL fields into the published `module.json`:
  - `version` = the tag **with the leading `v` stripped** (Foundry version comparison breaks on inconsistent `v` prefixes).
  - `manifest` = the stable `releases/latest/download/module.json` alias (consulted for update detection).
  - `download` = the version-pinned `releases/download/<tag>/module.zip`.
- The zip contains only runtime files (`module.json`, `scripts/` incl. vendored Three.js, `styles/`, `templates/`, `README.md`); it excludes `node_modules/`, `openspec/`, `.claude/`, `.github/`, `package*.json`, `setup.js`, and VCS metadata.
- Fill the committed `module.json` `url` field with the repository URL. (`manifest`/`download` in the committed file may stay empty or hold the latest alias; the released copy is authoritative.)
- Add a short "Installation" section to `README.md` documenting the manifest URL and the `git tag vX.Y.Z && git push --tags` release ritual.

Out of scope: submission to the official Foundry package registry (a separate manual step), and `package.json` version syncing (the git tag is the single source of truth).

## Capabilities

### New Capabilities
- `release-distribution`: Producing an installable, auto-updatable GitHub Release from a version tag — what triggers a release, what the published artifacts contain, how the runtime Three.js dependency is included, and how the manifest/download/version fields must be shaped for Foundry to install and detect updates.

### Modified Capabilities
<!-- None — this adds distribution plumbing; no existing globe/runtime spec behavior changes. -->

## Impact

- New file: `.github/workflows/release.yml`.
- Edited: `module.json` (`url` field), `README.md` (install + release docs).
- No runtime/module code changes; the globe behavior is untouched.
- Operational: the first `git push` publishes the locally-rewritten history to `origin` (`github.com/kjkm/foundry-planetside`). Per the user's standing rule, that initial push remains an explicit user action, not performed by CI or the assistant.
- Depends on the existing `setup.js` vendoring step and the `three@0.160.0` devDependency resolving in CI.
