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

## 2026-10-04 improvement pass

- Request: 改进项目，UI、性能、交互逻辑等。
- Baseline findings: sidebar obscures the arena; fixed cell size leaves desktop map in a corner; reconnect tokens expire during active play; spawn positions may be outside the board; revive is optimistic; collisions depend on map iteration order; touch/keyboard controls need cancellation and focus guards.
- Fixed the Vite proxy to forward only `/snake/ws`, so `/snake/` serves the current Vite source instead of stale backend build assets.
- Parallel work: server game/session correctness; client connection lifecycle; responsive grayscale UI and demand-driven canvas rendering.
- Implemented a grayscale lobby with rules and remembered nickname; separated responsive arena and ranking panel; added collapsible portrait rankings, coarse-pointer direction buttons, minimap, fullscreen, accessible revive button and explicit leave.
- Canvas now redraws on state/resize/visibility updates, reuses a static background, caps DPR at 2 and avoids per-frame body slicing. Local Chromium measured 6 canvas redraws/second during ordinary live play, compared with an unconditional frame loop previously.
- Fixed input focus/modifier/repeat guards, restricted joystick starts to the arena, reset touch state on cancel/blur/visibility loss, and avoided repeated touch directions.
- Server: safe bounded spawns, distinct unoccupied food, two-turn queue, simultaneous collisions (head-on/swap draws), score-preserving respawn, permanent connected tokens with 30-second disconnect grace, rotated tokens and stale-socket identity guards.
- Network/UI: bounded reconnect backoff, handshake/stream watchdogs, malformed-frame rejection, safe storage, confirmed respawn, error feedback, explicit close4001 leave. Idle arena sends one snapshot every five seconds so the client watchdog does not reconnect unnecessarily.
- Validation: client production build; 5 client utility regressions; 17 game/server WebSocket regressions. Real Chromium checked join, opposite-turn rejection, F/fullscreen, reconnect identity, dead reload, Enter revive and preserved score, leave/name retention, DPR cap, no HUD overlap, 390×844 / 844×390 / 320×568 layouts, real touch drag/cancel, direction buttons, ranking collapse. No page/console errors.
- Inspected desktop lobby/play/death, all three mobile play screenshots, and skill-client gameplay screenshot + authoritative JSON state. Reusable connection lifecycle browser regressions are saved in client/src/hooks/useGameConnection.browser.test.mjs.

## Remaining boundaries

- No production deployment or push requested. Performance measurement is a local normal-game redraw count, not a large-player server load benchmark.
- Retained the server-authoritative real-time advanceTime hook; multiplayer stepping is intentionally not deterministic.
- Independent final review found full-map floating point rounding could cut one column; added epsilon and two viewport regressions. Removed incorrect modal semantics from the arena-local death dialog and added a focus fallback when revive is disabled.
- Connection lifecycle: 6 reusable Chromium groups passed, including token fallback/rotation, stale events, confirmed/timed-out/rejected respawn, blocked storage, retry exhaustion/manual retry, watchdogs, and unmount vs explicit leave.
- Final suites passed: 7 client Node tests, 17 server Node/WebSocket tests, 6 connection browser groups plus real game UI scenarios. No required follow-up remains; optional next work is a measured many-player load test and smoother server-snapshot interpolation if desired.

## 2026-10-04 multiplayer verification

- Follow-up question: 多人联机对战正常吗？
- Two independent Chromium browser contexts used real WebSockets against an isolated instance of the current game server. Verified shared snapshot/ranking agreement, body collision and exactly +100 for survivor, correct victim/killer UI, score/identity-preserving respawn visible to opponent, immediate leave removal, and head-on draw with no bonus. No browser page/console errors; killer/victim screenshots visually inspected.
- Independent two-client WebSocket protocol probe also passed snapshot equality, death routing, +100 scoring, respawn, leave, illegal/reverse directions and two-turn queue bounds.
- Collision positions were seeded only in the temporary test world to exercise reproducible interactions. Current user preview remained untouched. WAN latency, cross-device access and large-player load were not tested.
- Delivery cleanup: stop tracking the generated client/dist/index.html while retaining the local build; dist assets are already ignored and deployment regenerates the entire bundle from source.
