## 1. Manifest fields

- [x] 1.1 Set `module.json` `url` to `https://github.com/kjkm/foundry-planetside`
- [x] 1.2 Pre-fill `module.json` `manifest` with the latest alias `https://github.com/kjkm/foundry-planetside/releases/latest/download/module.json`; leave `download` empty (CI writes the pinned URL into the released copy)

## 2. Release workflow

- [x] 2.1 Create `.github/workflows/release.yml` triggered on `push` of tags matching `v*`, with `permissions: contents: write`
- [x] 2.2 Steps: `actions/checkout`, `actions/setup-node` (Node 20), `npm ci` (runs `setup.js` to vendor Three.js)
- [x] 2.3 Guard: fail the build if `scripts/vendor/three.module.js` is missing or empty
- [x] 2.4 Derive `VERSION` from the tag with the leading `v` stripped; rewrite the working `module.json` with `jq`: set `version=$VERSION`, `manifest=<latest alias>`, `download=<pinned …/releases/download/<tag>/module.zip>`, `url=<repo>`
- [x] 2.5 Build `module.zip` from the allowlist (`module.json`, `scripts/` incl. `vendor/`, `styles/`, `templates/`, `README.md`), rooted at a `planetside/` folder; exclude dev files
- [x] 2.6 Publish the release with `softprops/action-gh-release`, attaching `module.json` and `module.zip` to the tag

## 3. Documentation

- [x] 3.1 Add an "Installation" section to `README.md` with the manifest URL to paste into Foundry
- [x] 3.2 Add a "Releasing" note to `README.md`: `git tag vX.Y.Z && git push --tags`

## 4. Verification

- [x] 4.1 Validate the change: `openspec validate add-release-pipeline --strict`
- [x] 4.2 Lint the workflow YAML (e.g. `actionlint`, or a syntax check) and dry-review the `jq` rewrite output locally against a copy of `module.json`
- [ ] 4.3 (Post-merge, user-gated) Push `main`, tag `v0.1.0`, confirm the Action publishes a release whose `module.json` has bare version + correct manifest/download, then install in Foundry via the manifest URL and confirm the globe renders (Three.js present)
