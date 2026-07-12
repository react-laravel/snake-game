Original prompt: 改进代码，提取组件化

## Progress

- 2026-07-10: Inspected the React client and identified `App.tsx` as the main coupling point for networking, controls, canvas rendering, and HUD composition.
- 2026-07-10: Extracted WebSocket lifecycle/state into `useGameConnection`, keyboard/touch input into `useGameControls`, and viewport/debug concerns into focused hooks.
- 2026-07-10: Extracted `GameCanvas`, pure canvas rendering helpers, and `GameHud`; reduced `App.tsx` to page composition.
- 2026-07-10: Added `window.render_game_to_text` and a server-authoritative `window.advanceTime` wait hook for browser testing.
- 2026-07-10: Client production build and server syntax check pass.
- 2026-07-10: Playwright verified join, keyboard movement, alive/dead state, death overlay, respawn click, screenshots, text state, and no console errors.

## TODO

- Optional follow-up: constrain random spawn positions so a newly joined or respawned snake cannot immediately hit a nearby wall.
