## Context

`planetside` is a single-folder Foundry VTT module (id `planetside`, currently `0.1.0`, compat 12–13). Installation today is manual folder-copy. The runtime depends on Three.js, which is **vendored at build time, not committed**: `scripts/vendor/three.module.js` is `.gitignore`'d and produced by `setup.js` (run via the `postinstall`/`vendor` npm scripts) by copying from `node_modules/three` (`three@0.160.0`). The repo already has an `origin` remote at `github.com/kjkm/foundry-planetside` with no commits pushed yet. This change adds the standard Foundry GitHub-Releases distribution pipeline so the module installs via a manifest URL and reports updates in-app.

## Goals / Non-Goals

**Goals:**
- One-time "Install via Manifest URL" works against a stable URL, and Foundry auto-detects future versions.
- Releases are reproducible from a single action: push a `v*` tag.
- The published zip is self-contained (includes vendored Three.js) and free of dev/spec clutter.
- Conform to documented Foundry conventions (stable `manifest` alias, version-pinned `download`, no `v` prefix in version values).

**Non-Goals:**
- Submitting to the official Foundry package registry (separate manual step; would require the *pinned* manifest URL, not `latest`).
- Keeping `package.json`'s `version` in sync (the tag is the single source of truth).
- Any change to globe rendering / runtime behavior.
- Code signing, multi-platform matrices, changelog generation.

## Decisions

### D1 — Tag-driven release (`on: push: tags: ['v*']`)
Pushing an annotated tag `vX.Y.Z` is the trigger. The version fed to `module.json` is the tag with the leading `v` stripped (`vX.Y.Z` → `X.Y.Z`).
- *Why:* Matches the dominant community convention; nothing is committed by a bot; the human stays in control of when a release happens. Foundry's version comparison misbehaves with inconsistent `v` prefixes, so the value written into the manifest must be bare.
- *Alternatives:* (a) `version.txt`-in-`main` actions (e.g. foundry-release-action) — more moving parts for a solo repo. (b) Release-on-`main`-push — too easy to publish accidentally. (c) Manual release upload — exactly the friction we're removing.

### D2 — `npm ci` before zipping (vendor Three.js in CI)
The job runs `npm ci`, which triggers `postinstall → setup.js`, materializing `scripts/vendor/three.module.js` before the zip is assembled.
- *Why:* This is the load-bearing subtlety. The vendor file is `.gitignore`'d, so a `git archive` / source-only zip ships a module that fails to load Three.js. Running the existing vendoring step keeps a single source of truth for the Three.js version (`package.json`), rather than committing a 1.3 MB binary.
- *Alternatives:* (a) Commit `three.module.js` (un-gitignore) — bloats history, duplicates the dependency pin. (b) Import Three.js from a CDN at runtime — changes module runtime behavior and adds a network dependency; out of scope.

### D3 — Manifest/download URL split
The `module.json` *inside each release* is rewritten so:
- `manifest` → `https://github.com/kjkm/foundry-planetside/releases/latest/download/module.json` (floating alias Foundry polls for updates)
- `download` → `https://github.com/kjkm/foundry-planetside/releases/download/<tag>/module.zip` (pinned to this release)
- `version` → `<tag without v>`
- `url` → repo URL
- *Why:* This is precisely the pattern that makes update detection work: Foundry refetches the `latest` manifest, compares its `version` to the installed one, and pulls the pinned `download`. Editing happens in CI (e.g. `jq`/`sed` or a community action) so the committed file needn't track release URLs.

### D4 — Explicit zip allowlist (runtime files only)
Assemble the zip from an explicit include list — `module.json`, `scripts/` (incl. `vendor/`), `styles/`, `templates/`, `README.md` — rather than "zip everything minus excludes".
- *Why:* Allowlist is safer than denylist: new dev artifacts (future `openspec/` content, `.claude/`, caches) can't silently leak into a release. Foundry only needs the files referenced by `module.json` plus assets.
- *Layout note:* Foundry expects the zip to unpack into a folder named `planetside/` (matching `id`). The packaging step must root the archive at that folder name (either zip a `planetside/` dir, or rely on the chosen action's module-id rooting).

### D5 — Use a maintained packaging action vs. hand-rolled shell
Prefer a small, well-used building block where it removes footguns. Two viable shapes:
- **(a) Hand-rolled:** `actions/checkout` → `actions/setup-node` + `npm ci` → `jq` rewrite of `module.json` → `zip` the allowlist → `softprops/action-gh-release` to attach `module.json` + `module.zip`.
- **(b) Action-assisted:** same, but a Foundry-specific release/zip action handles the manifest field rewrite + rooting.
- *Decision:* Go **(a) hand-rolled with `softprops/action-gh-release`** for the upload, doing the `module.json` rewrite with `jq`. It keeps the Three.js vendoring step explicit and visible (the part most likely to break), avoids coupling to a third-party action's assumptions about where the manifest lives, and is easy to audit. Revisit (b) only if the YAML gets unwieldy.

## Risks / Trade-offs

- **Vendored Three.js missing from zip** → module loads but globe is blank. *Mitigation:* `npm ci` runs before packaging; a CI guard asserts `scripts/vendor/three.module.js` exists and is non-empty before zipping; spec requires it.
- **`v` prefix leaking into `version`** → Foundry update detection silently breaks. *Mitigation:* strip `v` in the workflow; spec scenario covers it.
- **Wrong archive root folder** → Foundry extracts to a misnamed folder, module not detected. *Mitigation:* root the zip at `planetside/`; verify on first install.
- **`manifest`/`download` swapped or both pinned** → no update detection, or `latest` self-reference loop. *Mitigation:* D3 fixes the split explicitly; spec scenario asserts each field's shape.
- **First push publishes rewritten history** → public, irreversible-ish. *Mitigation:* the initial `git push` is a deliberate user action, gated on explicit user go-ahead (standing rule); not done by CI or assistant.
- **`npm ci` needs a committed `package-lock.json`** → it is committed (confirmed in `git ls-files`), so CI install is deterministic.

## Migration Plan

1. Land the workflow + `module.json` `url` + README docs on `main` (local).
2. User pushes `main` to `origin` (explicit, gated).
3. User tags `v0.1.0` (or next version) and pushes the tag → workflow publishes the first Release.
4. In Foundry: Install Module → Manifest URL → `…/releases/latest/download/module.json`.
5. Rollback: delete the bad Release + tag; prior releases remain installable. No server-side state to unwind.

## Open Questions

- Tag the current state as `v0.1.0`, or start the public line at `v0.1.1` to distinguish pre-pipeline builds? (Lean: `v0.1.0` — nothing was ever published, so the number is unused.)
- Keep committed `module.json` `manifest`/`download` empty, or pre-fill the `latest` alias for documentation value? (Lean: pre-fill `manifest` with the alias + `url`; leave `download` to CI — harmless and self-documenting.)
