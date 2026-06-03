## ADDED Requirements

### Requirement: Module re-evaluates activation when planetside.enabled flag changes on the current scene

While the module is loaded, on every `updateScene` hook for the currently active canvas scene whose update changes the `flags.planetside.enabled` flag, the module SHALL re-evaluate its activation state:
- If the new flag value is truthy and the module is currently inactive, the module SHALL activate.
- If the new flag value is falsy and the module is currently active, the module SHALL deactivate.

This SHALL happen without requiring a world reload, scene switch, or canvas re-render trigger from the user.

#### Scenario: Toggling enabled to true on current scene activates the globe

- **WHEN** the currently loaded scene's `flags.planetside.enabled` is updated to true (e.g., via the scene config tab) and the module is currently inactive
- **THEN** the module activates on the live canvas, displaying the globe view

#### Scenario: Toggling enabled to false on current scene deactivates the globe

- **WHEN** the currently loaded scene's `flags.planetside.enabled` is updated to false and the module is currently active
- **THEN** the module deactivates and the original PIXI canvas becomes visible again

#### Scenario: Updates to non-current scenes do not affect the live canvas

- **WHEN** a scene that is not the currently loaded canvas scene has its `flags.planetside.enabled` flag updated
- **THEN** the live canvas's active state does not change
- **AND** the new flag value takes effect the next time that scene is loaded as the active canvas
