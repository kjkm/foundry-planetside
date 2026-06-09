## ADDED Requirements

### Requirement: Globe camera focuses on a pull ping's location

While Planetside is active, when a GM issues a pull (Shift+long-press), the module SHALL ease the globe camera to the pulled location instead of leaving it where it is. The GM SHALL broadcast the pull on a scene-scoped module socket; each client with Planetside active for that scene SHALL convert the pulled scene coordinate to a camera target via the same scene→target mapping used for the default-view opening (`azimuth = lon`, `elevation = lat`) and call the camera `focus()` operation with animation. This SHALL apply on every such client, including the initiating GM (who focuses locally, since socket emits do not loop back to the sender). A client viewing a different scene SHALL be unaffected (the pull carries the originating scene id). An in-progress pull focus SHALL yield to manual orbit (consistent with `focus()` being cancelled when the user begins dragging). The socket listener SHALL be installed when Planetside activates and removed when it deactivates.

#### Scenario: A GM pull rotates each client's globe to the location

- **WHEN** a GM fires a pull ping and a client has Planetside active
- **THEN** that client's globe camera eases (via `focus()`) so the pulled location is centered in view

#### Scenario: The initiating GM's globe also follows the pull

- **WHEN** a GM fires a pull ping while their own Planetside globe is active
- **THEN** the GM's globe camera also eases to the pulled location

#### Scenario: Manual orbit interrupts a pull focus

- **WHEN** a pull focus is in progress and the user starts dragging to orbit
- **THEN** the focus is cancelled and the camera follows the user's input
