import { randomUUID } from 'node:crypto';

const VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIRECTIONS = Object.keys(VECTORS);
const OPPOSITES = { up: 'down', down: 'up', left: 'right', right: 'left' };
const key = ({ x, y }) => `${x},${y}`;

function hashString(value) {
  let hash = 0;
  for (const char of value) hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
  return hash >>> 0;
}

export function createGame({ width = 60, height = 40, foodCount = 15, random = Math.random, now = Date.now, makeId = randomUUID } = {}) {
  const players = new Map();
  const foods = [];
  let sequence = 0;
  const inside = ({ x, y }) => x >= 0 && x < width && y >= 0 && y < height;

  function occupiedCells(includeFood = false) {
    const occupied = new Set();
    for (const player of players.values()) {
      if (player.alive) for (const segment of player.snake) occupied.add(key(segment));
    }
    if (includeFood) for (const food of foods) occupied.add(key(food));
    return occupied;
  }

  function refillFood() {
    if (foods.length >= foodCount) return;
    const occupied = occupiedCells(true);
    while (foods.length < foodCount) {
      const offset = Math.floor(random() * width * height);
      let position;
      for (let i = 0; i < width * height; i++) {
        const cell = (offset + i) % (width * height);
        const candidate = { x: cell % width, y: Math.floor(cell / width) };
        if (!occupied.has(key(candidate))) {
          position = candidate;
          break;
        }
      }
      if (!position) break; // A full arena must never create overlapping food.
      foods.push({ id: makeId(), ...position });
      occupied.add(key(position));
    }
  }

  function spawnCandidate(head, dir, occupied, snakeCells) {
    const [dx, dy] = VECTORS[dir];
    const body = [head, { x: head.x - dx, y: head.y - dy }, { x: head.x - 2 * dx, y: head.y - 2 * dy }];
    if (body.some(cell => !inside(cell) || occupied.has(key(cell)))) return null;
    let lead = 0;
    for (let step = 1; step <= 10; step++) {
      const ahead = { x: head.x + dx * step, y: head.y + dy * step };
      if (!inside(ahead) || snakeCells.has(key(ahead))) break;
      lead++;
    }
    if (lead < 1) return null;
    const openSide = [1, -1].some(sign => {
      const side = { x: head.x + dy * sign, y: head.y - dx * sign };
      return inside(side) && !snakeCells.has(key(side));
    });
    // Lower is safer. Eight steps is about 1.2s at the 150ms tick.
    const tier = lead >= 8 && openSide ? 0 : lead >= 8 ? 1 : lead >= 3 && openSide ? 2 : lead >= 3 ? 3 : openSide ? 4 : 5;
    return { body, dir, tier };
  }

  function spawn(id, name, color, score = 0) {
    const occupied = occupiedCells(true);
    const snakeCells = occupiedCells();
    const start = Math.floor(random() * width * height);
    const dirShift = Math.floor(random() * DIRECTIONS.length);
    let best = null;
    for (let i = 0; i < width * height && best?.tier !== 0; i++) {
      const cell = (start + i) % (width * height);
      const head = { x: cell % width, y: Math.floor(cell / width) };
      for (let offset = 0; offset < DIRECTIONS.length && best?.tier !== 0; offset++) {
        const candidate = spawnCandidate(head, DIRECTIONS[(dirShift + offset) % DIRECTIONS.length], occupied, snakeCells);
        if (candidate && (!best || candidate.tier < best.tier)) best = candidate;
      }
    }
    if (!best) return null;
    const player = {
      id, name, color: color || `hsl(${hashString(id) % 360}, 70%, 55%)`,
      snake: best.body, dir: best.dir, turns: [], alive: true, frozen: false, score, lastScoreTime: now(), deathTime: null,
    };
    players.set(id, player);
    sequence++;
    return player;
  }

  function addPlayer(name, color) {
    return spawn(makeId(), name, color);
  }

  function respawn(id) {
    const player = players.get(id);
    if (!player || player.alive) return player || null;
    return spawn(id, player.name, player.color, player.score);
  }

  function setDirection(id, direction) {
    const player = players.get(id);
    if (!player?.alive || !Object.hasOwn(VECTORS, direction) || player.turns.length >= 2) return false;
    const previous = player.turns.at(-1) || player.dir;
    if (previous === direction || previous === OPPOSITES[direction]) return false;
    player.turns.push(direction);
    return true;
  }

  function removePlayer(id) {
    if (players.delete(id)) sequence++;
  }

  function setFrozen(id, frozen) {
    const player = players.get(id);
    if (!player) return false;
    const next = Boolean(frozen);
    if (player.frozen === next) return true;
    player.frozen = next;
    if (!next) player.lastScoreTime = now();
    return true;
  }

  function tick() {
    const timestamp = now();
    const foodByCell = new Map(foods.map(food => [key(food), food]));
    const moves = new Map();
    const heads = new Map();
    const previousHeads = new Map();
    const bodies = new Map();

    // Plan every move before touching anyone's snake. Collision results are
    // independent of join order, including snakes that die on this same tick.
    for (const player of players.values()) {
      if (!player.alive) continue;
      if (player.frozen) {
        player.lastScoreTime = timestamp;
        for (const segment of player.snake) {
          const owners = bodies.get(key(segment)) || new Set();
          owners.add(player.id);
          bodies.set(key(segment), owners);
        }
        continue;
      }
      player.dir = player.turns.shift() || player.dir;
      const [dx, dy] = VECTORS[player.dir];
      const head = { x: player.snake[0].x + dx, y: player.snake[0].y + dy };
      const food = foodByCell.get(key(head));
      const snake = [head, ...player.snake];
      if (!food) snake.pop();
      const move = { player, head, snake, food, previousHead: player.snake[0] };
      moves.set(player.id, move);
      previousHeads.set(key(move.previousHead), player.id);
      const cellHeads = heads.get(key(head)) || [];
      cellHeads.push(player.id);
      heads.set(key(head), cellHeads);
      for (const segment of snake.slice(1)) {
        const owners = bodies.get(key(segment)) || new Set();
        owners.add(player.id);
        bodies.set(key(segment), owners);
      }
    }

    const deaths = new Map();
    for (const [id, move] of moves) {
      const { head } = move;
      const bodyOwners = bodies.get(key(head));
      if (!inside(head)) deaths.set(id, { killerId: null, cause: 'wall' });
      else if (bodyOwners?.has(id)) deaths.set(id, { killerId: null, cause: 'self' });
      else if (heads.get(key(head)).length > 1) deaths.set(id, { killerId: null, cause: 'head-on' });
      else {
        const otherId = previousHeads.get(key(head));
        const other = moves.get(otherId);
        const swap = other && otherId !== id && key(other.head) === key(move.previousHead);
        if (swap) deaths.set(id, { killerId: null, cause: 'head-on' });
        else if (bodyOwners?.size) deaths.set(id, { killerId: [...bodyOwners].sort()[0], cause: 'body' });
      }
    }

    const eaten = new Set();
    for (const [id, move] of moves) {
      const player = move.player;
      if (deaths.has(id)) continue;
      player.snake = move.snake;
      if (move.food) {
        eaten.add(move.food.id);
        player.score += 10;
      }
      const elapsed = Math.floor((timestamp - player.lastScoreTime) / 1000);
      if (elapsed >= 1) {
        player.score += elapsed;
        player.lastScoreTime += elapsed * 1000;
      }
    }

    const events = [];
    for (const [id, info] of deaths) {
      const victim = players.get(id);
      const killer = info.killerId ? players.get(info.killerId) : null;
      victim.alive = false;
      victim.deathTime = timestamp;
      victim.snake = [];
      victim.turns = [];
      victim.frozen = false;
      // Award a kill only when its owner survives the simultaneous collision.
      const scoringKill = Boolean(killer && !deaths.has(killer.id));
      if (scoringKill) killer.score += 100;
      events.push({ victim, killer, cause: info.cause, scoringKill });
    }
    if (eaten.size) {
      for (let i = foods.length - 1; i >= 0; i--) if (eaten.has(foods[i].id)) foods.splice(i, 1);
    }
    refillFood();
    sequence++;
    return events;
  }

  function state(tickMs = 150) {
    return {
      type: 'gameState', seq: sequence, tickMs,
      players: [...players.values()].map(({ id, name, snake, alive, color, dir, frozen }) => ({ id, name, snake, alive, color, dir, frozen: Boolean(frozen) })),
      foods,
      scores: Object.fromEntries([...players.values()].map(({ id, name, score, alive }) => [id, { name, score, alive }])),
    };
  }

  refillFood();
  return { players, foods, width, height, addPlayer, respawn, removePlayer, setDirection, setFrozen, tick, state };
}
