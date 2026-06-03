# starfield Specification

## Purpose
TBD - created by archiving change globe-battlemap-renderer. Update Purpose after archive.
## Requirements
### Requirement: Procedural star field rendered as a large Points cloud

The module SHALL add a `THREE.Points` mesh of 5000 vertices to the main scene, with vertices placed uniformly at random on a sphere of radius substantially larger than the planet (`STAR_RADIUS` ~150). The `PointsMaterial` SHALL use `sizeAttenuation: false` so each star renders at a constant pixel size regardless of distance, and per-vertex colors.

#### Scenario: Stars visible in the space around the planet

- **WHEN** the camera views any area of space around the planet
- **THEN** scattered point-sized stars are visible against the black background

#### Scenario: Stars occluded by the planet

- **WHEN** the camera views a region of the sky where the planet body is in the way
- **THEN** stars behind the planet are not visible (depth-test occlusion)

#### Scenario: Stars do not visibly shift with camera orbit

- **WHEN** the camera orbits around the planet
- **THEN** the stars do not noticeably parallax (they read as if at infinity)

### Requirement: Stars have brightness and color variation

The starfield SHALL include per-star brightness variation skewed toward dim (most stars faint, a few bright) and color tint variation. The color distribution SHALL include:
- A majority of white or near-white stars.
- A small population of bluish-tinted stars.
- A smaller population of warm yellow stars.
- A rare population of dim red-orange dwarf stars, where both the brightness cap and the red dominance are explicit (these do not merely use the normal brightness roll).

#### Scenario: Most stars appear white

- **WHEN** the starfield is rendered
- **THEN** the majority of visible stars appear approximately white

#### Scenario: Occasional tinted stars are visible

- **WHEN** scanning the starfield carefully
- **THEN** some stars appear noticeably bluer or warmer than the surrounding white stars

#### Scenario: Rare dim red-orange stars are visible

- **WHEN** scanning the starfield
- **THEN** a small number of dim red-orange points are present, distinguishable both by their warmer color and their lower brightness

