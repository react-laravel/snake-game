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

## 2026-11-09 motion blend pass

- Added tick-aligned snake motion blending between authoritative `gameState` snapshots (`getSnakeMotionShift` + `GameCanvas` rAF while blend &lt; 1).
- Frozen snakes skip the offset so disconnect pause does not wiggle on screen; `prefers-reduced-motion` keeps discrete steps.
- Client regression: motion shift unit test; validate with `pnpm test` and `pnpm run build` in `client/`.
- Optional next: many-player load benchmark.
- Lobby `useLobbyPresence` shows live player counts via spectator WebSocket; in-game ping/pong every 5s drives top-bar latency (warn above 200ms).

## 2026-11-09 engagement pass

- Smooth cropped-map camera via `getCameraHead` (aligned with tick motion blend).
- Local personal best (`snake_best_score`), lobby hint, death overlay record callout, score badge bump on gains.
- Death overlay `Enter` respawn hotkey.

## 2026-11-09 ops & lobby pass

- `scripts/load-benchmark.mjs` + root `pnpm benchmark:load` for join latency, snapshot rate, ping p50/p95.
- `GET /snake/status` arena metrics for monitoring.
- Lobby footer copies invite URL to clipboard.

## 2026-11-09 clarity pass

- Client turn queue mirrors server limits (`directionQueue`) with HUD/canvas `↑←` hints.
- Scoreboard marks disconnected snakes as 断线中; kill toasts emphasize scoring kills.
- Score badge shows chase-to-record copy; Vite proxies `/snake/status` and `/health` in dev.

## 2026-11-09 life feedback

- Per-life food and kill counts from length growth and scoring death events; shown on the death card.
- Optional sine cues (eat / kill / death), off by default, toggled from the top bar and stored in `snake_sound`.

## 2026-11-09 lookahead

- `immediateThreat` warns when the next cell, including a queued turn, is a wall or a body that will not vacate.
- Footer copy plus a cell outline. A moving tail is ignored, matching the server rule that the tail leaves this tick.
- A clear next cell still warns when the following cell is a wall. The score badge shows live rank.

## 2026-11-09 food pointer

- On a cropped view, the nearest off-screen food gets an edge arrow and its Manhattan distance. Food already on screen is left unmarked.
- The nearest food is also ringed wherever it is visible. Scoreboard rows include each living snake's length.
- Snake bodies render as one rounded stroke. Names stay on you and on opponents within 12 cells; a dead player still sees every name.
- The minimap rings the nearest food. The score badge shows your length, and M toggles sound.
- Food arrows slide clear of the minimap. Both the lobby and the match can copy the same invite link.
- A wall two cells ahead outlines the last in-bounds cell, so the warning stays on screen.
- The scoreboard marks the longest living snake. Equal lengths keep the higher-ranked player. Its head is also ringed on the board and boxed on the minimap.
- Head-on warning when another moving snake will enter your next cell, or when two heads will swap. Their queued turns stay unknown; a frozen snake does not count.
- A cropped view points at the nearest living opponent with a hollow arrow and Manhattan distance. It stays clear of the food arrow and the minimap.
- Snake motion follows the previous body. A turn no longer slides the tail sideways, and eating only extends the head.

## 2026-11-10 death spectator camera

- After death on a cropped map, the camera follows the killer if they are still alive, otherwise the longest living snake (equal lengths keep the scoreboard leader).
- `youDied` has no killer id, so the helper can also match a living killer by name. The overlay shows a grayscale 「正在观看 XXX」 banner; respawn snaps the camera back to self.
- Pure helpers live in `client/src/game/spectator.ts` with Node unit tests wired into `pnpm test`.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`. No protocol or scoring/collision changes.

## 2026-11-10 spectator camera pan

- The cropped death camera eases from the last viewpoint to a new follow target instead of jumping, including the first cut after death and an automatic switch when that snake dies.
- Respawn and `prefers-reduced-motion` still snap immediately back to self. Pan duration scales with distance and stays brief.
- Pure helpers (`startCameraPan`, `mixCameraHead`, `cameraPanDuration`) live in `client/src/game/spectator.ts` with added Node unit tests.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`. No protocol or scoring/collision changes.

## 2026-11-10 spawn runway hint

- After joining or respawning, the local snake's preferred open lead is marked for 1.2s (eight ticks): a dashed grayscale lane and footer copy such as 「前方 8 格开阔」.
- The helper matches the server runway rule: walls and snake bodies stop the lead, food does not. No scoring, collision, or protocol changes.
- Pure helpers live in `client/src/game/runway.ts` with Node unit tests wired into `pnpm test`.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 late-game readout

- After a match has had at least three living snakes, thinning to three or fewer shows a grayscale banner such as 「残局 · 还剩 2 人」 or 「全场只剩你」. A two-person lobby is not treated as a finale.
- During that late game, every living snake's name stays visible, not only nearby ones.
- Pure helpers live in `client/src/game/lateGame.ts` with Node unit tests wired into `pnpm test`. No scoring, collision, or protocol changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 life recap

- The death overlay now recaps the life that just ended: survival time, peak length, and scoreboard place, alongside the existing food and kill counts.
- Peak length is kept even after the server clears the dead body. The recap freezes at death so the timer does not keep running on the overlay.
- Pure helpers (`nextLifeCounters`, `lifeRecapCopy`, `formatSurvived`, `scoreboardPlace`) live in `client/src/game/lifeStats.ts` with added Node unit tests.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`. No scoring, collision, or protocol changes.

## 2026-11-10 lobby roster

- The join screen now lists who is already in the arena, with score and alive/out status, taken from the existing spectator `gameState`. Overflow past five names is summarized as 「还有 N 人」.
- Pure helpers live in `client/src/game/lobby.ts` with Node unit tests wired into `pnpm test`. No protocol or scoring changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 lead takeover

- Taking first place among at least one other player shows a brief grayscale 「升到第 1 名」 notice. The score badge also marks 「领先」 while you hold first and are still alive.
- The first snapshot is not treated as a takeover, and a solo lobby does not count as leading.
- Pure helpers live in `client/src/game/lead.ts` with Node unit tests wired into `pnpm test`. No protocol or scoring changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 session recap

- Leaving a match now shows a lobby recap of the session just ended: score, duration, lives, peak length, food, kills, and best place.
- Finished lives are banked so totals survive respawns; a current life is included if you leave while still alive. Empty sessions are omitted.
- Pure helpers live in `client/src/game/sessionRecap.ts` with Node unit tests wired into `pnpm test`. No protocol or scoring changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 spawn heading

- Joining or respawning now shows a brief grayscale notice such as 「向右出发 · 现在就能转向」, so the opening heading is obvious without freezing movement or inventing a countdown.
- The spawn direction is kept even if the player turns; a missing snapshot during reconnect does not count as a respawn. The window is independent of the spawn-runway hint.
- Pure helpers live in `client/src/game/heading.ts` with Node unit tests wired into `pnpm test`. No scoring, collision, or protocol changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 reconnect restore

- After a mid-session drop, coming back to `connected` from `reconnecting` or `error` shows a brief grayscale notice: 「连接已恢复，蛇还在场上」 if you are still alive, or 「连接已恢复，积分仍保留」 if you were already out. The first join is not treated as a restore.
- The notice sits where the disconnect banner was, then clears itself. A new drop hides it immediately.
- Pure helpers live in `client/src/game/restore.ts` with Node unit tests wired into `pnpm test`. No protocol or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 sole survivor mark

- After a match that has had at least three living snakes thins to one, the last living player is marked 「独活」 on the score badge and the scoreboard. A one- or two-person lobby is not treated as a victory, and the mark is distinct from score-based 「领先」.
- This is a persistent label, not a new toast or banner; the existing late-game banner is unchanged.
- Pure helpers live in `client/src/game/sole.ts` with Node unit tests wired into `pnpm test`. No protocol or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 camera look-ahead

- On a cropped map, the follow camera looks a short way ahead in the current heading (or the last queued turn) so more of the path is visible, instead of staying centered on the head.
- The lead is a fraction of the visible span and keeps a trailing margin, so the head never leaves the view. Full-board layouts are unchanged. No new HUD, toast, or scoreboard label.
- Pure helpers live in `client/src/game/cameraLead.ts` with Node unit tests wired into `pnpm test`. No protocol or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 body taper

- Snake bodies now taper over the last eight segments, down to half width at the tail, so head and tail stay easy to tell apart in a crowd. The rest of the body keeps full thickness.
- Pure helper `bodyTaper` lives in `client/src/game/bodyTaper.ts` with Node unit tests wired into `pnpm test`. No camera, HUD, protocol, or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 joystick hysteresis

- The touch stick now keeps its current heading around a diagonal until the other axis clearly wins, so a slight wobble no longer flips a queued turn. The existing 25% dead zone is unchanged.
- Pure helper `joystickDirection` lives in `client/src/game/joystick.ts` with Node unit tests wired into `pnpm test`. No camera, body, HUD, protocol, or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 board pattern

- The arena now uses a subtle grayscale checkerboard locked to world cells, so the pattern and grid lines stay put as the camera eases and food sits clearly on a square. The previous flat fill and faint lines made small cells hard to count.
- Pure helpers live in `client/src/game/boardPattern.ts` with Node unit tests wired into `pnpm test`. No camera math, body, joystick, HUD, protocol, or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 food pellets

- Food is drawn as a slightly larger grayscale pellet with an upper-left highlight, so it stays readable on small cells and against the checkerboard. The nearest pellet remains ringed and a bit bigger; the minimap uses the same sizing rule.
- Pure helpers live in `client/src/game/foodMark.ts` with Node unit tests wired into `pnpm test`. No camera, body, joystick, board pattern, HUD arrows, protocol, or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 keyboard layout

- Keyboard steering now prefers physical WASD positions (`event.code`) and falls back to the letter or arrow `key`, so the same key cluster works on AZERTY and similar layouts. QWERTY behavior is unchanged.
- Pure helper `keyDirection` lives in `client/src/game/keyDirection.ts` with Node unit tests wired into `pnpm test`. No joystick, camera, protocol, or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 name plates

- Snake names now sit on a compact dark plate so they stay readable on the checkerboard and over light bodies. Your own caption is still 「名字 · 你」. Who gets a name, and when, is unchanged.
- Pure helpers live in `client/src/game/namePlate.ts` with Node unit tests wired into `pnpm test`. No camera, body, joystick, keyboard, food, board, HUD, protocol, or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.

## 2026-11-10 direction pad heading

- The on-screen direction pad now highlights the live heading and the first queued turn, so a tap shows which way the snake is already going and what comes next. Other buttons stay unmarked.
- Pure helpers live in `client/src/game/directionPad.ts` with Node unit tests wired into `pnpm test`. No camera, body, joystick, keyboard, food, board, name plate, toast, protocol, or scoring/collision changes.
- Validation: `pnpm test` and `pnpm run build` in `client/`, plus `pnpm test` in `server/`.
