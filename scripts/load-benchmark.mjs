#!/usr/bin/env node
/**
 * Multiplayer load probe against a running snake server.
 *
 * Usage:
 *   pnpm benchmark:load
 *   pnpm benchmark:load -- --players 24 --seconds 30
 */
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { WebSocket } = require('ws');

const DIRS = ['up', 'down', 'left', 'right'];
const OPPOSITES = { up: 'down', down: 'up', left: 'right', right: 'left' };

function parseArgs(argv) {
  const options = {
    url: 'ws://127.0.0.1:3333/snake/ws',
    players: 12,
    spectators: 4,
    seconds: 20,
    steerMs: 180,
    pingMs: 2000,
  };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--url') options.url = argv[++index];
    else if (token === '--players') options.players = Number(argv[++index]);
    else if (token === '--spectators') options.spectators = Number(argv[++index]);
    else if (token === '--seconds') options.seconds = Number(argv[++index]);
    else if (token === '--steer-ms') options.steerMs = Number(argv[++index]);
    else if (token === '--ping-ms') options.pingMs = Number(argv[++index]);
    else if (token === '--help' || token === '-h') options.help = true;
  }
  return options;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const rank = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[rank];
}

function pickDirection(current) {
  const choices = DIRS.filter((dir) => dir !== current && dir !== OPPOSITES[current]);
  return choices[Math.floor(Math.random() * choices.length)];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openClient(url, join, options, stats) {
  return new Promise((resolve) => {
    const socket = new WebSocket(url);
    const stateIntervals = [];
    const pingSamples = [];
    let dir = 'right';
    let steerTimer;
    let pingTimer;
    let lastStateAt = 0;
    const joinStarted = performance.now();

    const teardown = () => {
      clearInterval(steerTimer);
      clearInterval(pingTimer);
    };

    socket.on('open', () => {
      if (join) socket.send(JSON.stringify({ type: 'join', playerName: `Bot-${Math.random().toString(36).slice(2, 7)}` }));
    });

    socket.on('message', (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (message.type === 'welcome' && join) {
        stats.joinMs.push(performance.now() - joinStarted);
        dir = message.dir || dir;
        steerTimer = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const next = pickDirection(dir);
          dir = next;
          socket.send(JSON.stringify({ type: 'direction', dir: next }));
        }, options.steerMs);
        pingTimer = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          socket.pendingPing = performance.now();
          socket.send(JSON.stringify({ type: 'ping', t: Date.now() }));
        }, options.pingMs);
      }
      if (message.type === 'gameState') {
        const now = performance.now();
        if (lastStateAt > 0) stateIntervals.push(now - lastStateAt);
        lastStateAt = now;
      }
      if (message.type === 'pong' && socket.pendingPing) {
        pingSamples.push(performance.now() - socket.pendingPing);
        socket.pendingPing = 0;
      }
      if (message.type === 'error') stats.errors.push(message.code || 'error');
    });

    socket.on('error', () => stats.socketErrors++);
    resolve({ socket, stateIntervals, pingSamples, teardown });
  });
}

function closeClient(client) {
  return new Promise((resolve) => {
    const { socket, stateIntervals, pingSamples, teardown } = client;
    socket.once('close', () => {
      teardown();
      resolve({ stateIntervals, pingSamples });
    });
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(1000, 'benchmark');
    else {
      teardown();
      resolve({ stateIntervals, pingSamples });
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage: pnpm benchmark:load [-- options]
  --url        WebSocket URL (default ws://127.0.0.1:3333/snake/ws)
  --players    Joined bots (default 12)
  --spectators Spectator sockets (default 4)
  --seconds    Run duration (default 20)
  --steer-ms   Direction interval per bot (default 180)
  --ping-ms    App ping interval (default 2000)`);
    return;
  }

  const started = performance.now();
  const stats = { joinMs: [], errors: [], socketErrors: 0 };

  const clients = [];
  for (let player = 0; player < options.players; player++) clients.push(await openClient(options.url, true, options, stats));
  for (let spectator = 0; spectator < options.spectators; spectator++) clients.push(await openClient(options.url, false, options, stats));

  await delay(options.seconds * 1000);
  const results = await Promise.all(clients.map((client) => closeClient(client)));
  const elapsedSec = (performance.now() - started) / 1000;

  const stateIntervals = results.flatMap((entry) => entry.stateIntervals);
  const pingSamples = results.flatMap((entry) => entry.pingSamples);
  stateIntervals.sort((a, b) => a - b);
  pingSamples.sort((a, b) => a - b);
  const joinMs = [...stats.joinMs].sort((a, b) => a - b);

  console.log('\nSnake load benchmark');
  console.log('─'.repeat(48));
  console.log(`Target          ${options.url}`);
  console.log(`Connections     ${options.players} players + ${options.spectators} spectators`);
  console.log(`Duration        ${elapsedSec.toFixed(1)}s`);
  console.log(`Join OK         ${joinMs.length}/${options.players}`);
  if (joinMs.length) {
    console.log(`Join latency    p50 ${joinMs[Math.floor(joinMs.length * 0.5)].toFixed(0)} ms · p95 ${joinMs[Math.floor(joinMs.length * 0.95)].toFixed(0)} ms`);
  }
  console.log(`Snapshot rate   ${(stateIntervals.length / elapsedSec).toFixed(1)} state frames/s (all clients)`);
  if (stateIntervals.length) {
    console.log(`State interval  p50 ${percentile(stateIntervals, 0.5).toFixed(0)} ms · p95 ${percentile(stateIntervals, 0.95).toFixed(0)} ms`);
    console.log(`Tick estimate   ~${percentile(stateIntervals, 0.5).toFixed(0)} ms (median spacing)`);
  }
  if (pingSamples.length) {
    console.log(`App ping RTT    p50 ${percentile(pingSamples, 0.5).toFixed(0)} ms · p95 ${percentile(pingSamples, 0.95).toFixed(0)} ms`);
  }
  if (stats.errors.length) console.log(`Server errors   ${stats.errors.join(', ')}`);
  if (stats.socketErrors) console.log(`Socket errors   ${stats.socketErrors}`);
  console.log('─'.repeat(48));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
