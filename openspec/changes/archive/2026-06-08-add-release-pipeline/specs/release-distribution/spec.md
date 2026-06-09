## ADDED Requirements

### Requirement: Tag-triggered release build
The system SHALL publish a GitHub Release when, and only when, a tag matching `v*` is pushed to the repository. The release SHALL be produced by an automated GitHub Actions workflow committed at `.github/workflows/release.yml`.

#### Scenario: Pushing a version tag publishes a release
- **WHEN** a maintainer pushes a tag of the form `vX.Y.Z`
- **THEN** the workflow runs and creates a GitHub Release associated with that tag
- **AND** the release has `module.json` and `module.zip` attached as downloadable assets

#### Scenario: Non-tag pushes do not publish
- **WHEN** commits are pushed to a branch without a `v*` tag
- **THEN** no GitHub Release is created by this workflow

### Requirement: Released zip is a self-contained runtime bundle
The published `module.zip` SHALL contain every file required to run the module — including the vendored Three.js dependency — and SHALL exclude development-only files. The build SHALL run the project's vendoring step (`npm ci`, which triggers `setup.js`) before assembling the archive, because `scripts/vendor/three.module.js` is not committed.

#### Scenario: Vendored Three.js is present in the zip
- **WHEN** the workflow assembles `module.zip`
- **THEN** `npm ci` has already produced `scripts/vendor/three.module.js`
- **AND** that file exists and is non-empty inside the zip
- **AND** the workflow fails the build if the vendored file is missing or empty

#### Scenario: Runtime files included, dev files excluded
- **WHEN** the zip is built
- **THEN** it contains `module.json`, `scripts/` (including `scripts/vendor/`), `styles/`, `templates/`, and `README.md`
- **AND** it excludes `node_modules/`, `openspec/`, `.claude/`, `.github/`, `package.json`, `package-lock.json`, `setup.js`, and version-control metadata

#### Scenario: Archive roots at the module id folder
- **WHEN** Foundry extracts the published `module.zip`
- **THEN** the contents unpack into a folder named `planetside` matching the module `id`

### Requirement: Released manifest is shaped for Foundry install and update detection
The `module.json` attached to a release SHALL be rewritten so Foundry can install the module from a stable URL and detect future versions. The `version` value SHALL be the pushed tag with any leading `v` removed. The `manifest` field SHALL point to the stable latest-release alias, and the `download` field SHALL point to the version-pinned zip for that release.

#### Scenario: Version value has no leading v
- **WHEN** the tag `v0.1.1` is released
- **THEN** the released `module.json` `version` is `0.1.1` (no `v` prefix)

#### Scenario: Manifest field is the stable latest alias
- **WHEN** the released `module.json` is generated
- **THEN** its `manifest` field is `https://github.com/kjkm/foundry-planetside/releases/latest/download/module.json`

#### Scenario: Download field is pinned to the release
- **WHEN** the tag `v0.1.1` is released
- **THEN** the released `module.json` `download` field is `https://github.com/kjkm/foundry-planetside/releases/download/v0.1.1/module.zip`

#### Scenario: Update is detected after a newer release
- **GIVEN** a user has the module installed from the latest manifest alias
- **WHEN** a release with a higher `version` is published
- **THEN** Foundry's update check, reading the stable `manifest` URL, reports an available update
- **AND** installing it fetches the newer release's pinned `download` zip

### Requirement: Installation is documented
The repository SHALL document how to install the module via manifest URL and how to cut a release.

#### Scenario: README covers install and release
- **WHEN** a user reads `README.md`
- **THEN** it states the manifest URL to paste into Foundry's "Install Module → Manifest URL"
- **AND** it states the release ritual (`git tag vX.Y.Z` then `git push --tags`)

#### Scenario: Committed manifest carries the project url
- **WHEN** the committed `module.json` is inspected
- **THEN** its `url` field points to the project repository
