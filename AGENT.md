# AGENT Guidance

This file is for AI coding agents collaborating on this repository.

## Project Summary

- Multiplayer snake game.
- Frontend: React + TypeScript + Vite in `client/`.
- Backend: Express + WebSocket (`ws`) in `server/`.
- Runtime path prefix is `/snake`.

## Run Commands

- Frontend dev: `cd client && npm install && npm run dev`
- Frontend build: `cd client && npm run build`
- Backend dev: `cd server && npm install && npm run dev`
- Backend start: `cd server && npm run start`

## Architecture Notes

- Main gameplay orchestration is in `client/src/App.tsx`.
- Reusable UI is split under `client/src/components/`.
- Shared game types are in `client/src/types/game.ts`.
- Server tick loop and collision logic live in `server/index.js`.
- Pure world simulation and collision rules live in `server/game.js`; session lifecycle and broadcasting remain in `server/index.js`.
- Canvas redraws are scheduled by new state/resize/visibility, with static grid caching; avoid introducing an unconditional animation loop without an actual animated feature.

## Collaboration Rules

- Prefer small, focused files over one giant component.
- Keep data updates immutable in React state updates.
- Preserve current gameplay protocol message types (`join`, `rejoin`, `direction`, `respawn`, `gameState`, `playerDied`, `youDied`).
- Validate with `npm run build` in `client/` after frontend edits.
- Avoid destructive git commands.

## UI Direction

- Keep UI in grayscale dark tones, aligned with Chrome dark grays.
- Avoid colorful gradients or high-saturation accents for overlays.
- Ensure mobile and desktop remain playable.
