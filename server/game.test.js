import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.js';

const cellKey = ({ x, y }) => `${x},${y}`;
const create = options => createGame({ width: 12, height: 8, foodCount: 0, random: () => 0, now: () => 0, ...options });

function snake(game, id, positions, dir = 'right') {
  const player = {
    id, name: id, color: '#fff', snake: positions.map(([x, y]) => ({ x, y })),
    dir, turns: [], alive: true, score: 0, lastScoreTime: 0, deathTime: null,
  };
  game.players.set(id, player);
  return player;
}

test('spawns are in bounds and avoid snakes/food even with repeated random samples', () => {
  const game = create({ foodCount: 10 });
  const occupied = new Set(game.foods.map(cellKey));
  assert.equal(occupied.size, 10);
  for (let i = 0; i < 8; i++) {
    const player = game.addPlayer(`player-${i}`);
    assert.ok(player);
    for (const segment of player.snake) {
      assert.ok(segment.x >= 0 && segment.x < game.width && segment.y >= 0 && segment.y < game.height);
      assert.ok(!occupied.has(cellKey(segment)));
      occupied.add(cellKey(segment));
    }
  }
});

test('arena saturation never creates duplicate food and failed spawns leave state intact', () => {
  const game = create({ width: 4, height: 1, foodCount: 20 });
  assert.equal(game.foods.length, 4);
  assert.equal(new Set(game.foods.map(cellKey)).size, 4);
  assert.equal(game.addPlayer('No room'), null);
  assert.equal(game.players.size, 0);
});

test('two quick turns execute in order and reverse turns cannot sneak into the queue', () => {
  const game = create();
  const player = snake(game, 'a', [[5, 5], [4, 5], [3, 5]]);
  assert.equal(game.setDirection('a', 'left'), false);
  assert.equal(game.setDirection('a', 'up'), true);
  assert.equal(game.setDirection('a', 'down'), false);
  assert.equal(game.setDirection('a', 'left'), true);
  assert.equal(game.setDirection('a', 'down'), false); // Queue is bounded.
  game.tick();
  assert.deepEqual(player.snake[0], { x: 5, y: 4 });
  assert.equal(player.dir, 'up');
  game.tick();
  assert.deepEqual(player.snake[0], { x: 4, y: 4 });
  assert.equal(player.dir, 'left');
});

test('three-way head collisions kill everyone independently of player insertion order', () => {
  for (const order of [['a', 'b', 'c'], ['c', 'b', 'a'], ['b', 'a', 'c']]) {
    const game = create();
    const fixtures = {
      a: [[[4, 4], [3, 4], [2, 4]], 'right'],
      b: [[[6, 4], [7, 4], [8, 4]], 'left'],
      c: [[[5, 3], [5, 2], [5, 1]], 'down'],
    };
    for (const id of order) snake(game, id, ...fixtures[id]);
    assert.equal(game.tick().length, 3);
    for (const player of game.players.values()) {
      assert.equal(player.alive, false);
      assert.equal(player.score, 0);
      assert.deepEqual(player.snake, []);
    }
  }
});

test('a body stays solid until all collisions have resolved, even when its owner hits a wall', () => {
  for (const order of [['a', 'b'], ['b', 'a']]) {
    const game = create();
    const fixtures = {
      a: [[[0, 4], [1, 4], [2, 4]], 'left'],
      b: [[[1, 3], [1, 2], [1, 1]], 'down'],
    };
    for (const id of order) snake(game, id, ...fixtures[id]);
    const deaths = game.tick();
    assert.equal(deaths.length, 2);
    const bodyHit = deaths.find(({ victim }) => victim.id === 'b');
    assert.equal(bodyHit.killer.id, 'a');
    assert.equal(bodyHit.cause, 'body');
    assert.equal(bodyHit.scoringKill, false);
    assert.equal(deaths.find(({ victim }) => victim.id === 'a').cause, 'wall');
    assert.equal(game.players.get('a').score, 0);
  }
});

test('head swaps collide even for length-one snakes', () => {
  const game = create();
  snake(game, 'a', [[4, 4]], 'right');
  snake(game, 'b', [[5, 4]], 'left');
  const deaths = game.tick();
  assert.equal(deaths.length, 2);
  assert.ok(deaths.every(event => event.cause === 'head-on' && event.scoringKill === false));
});

test('moving into a tail that vacates this tick is allowed', () => {
  const game = create();
  const player = snake(game, 'a', [[4, 4], [4, 3], [3, 3], [3, 4]], 'left');
  assert.deepEqual(game.tick(), []);
  assert.equal(player.alive, true);
  assert.deepEqual(player.snake[0], { x: 3, y: 4 });
});

test('eating grows once, gives ten points, and replenishes only distinct unoccupied cells', () => {
  const game = create({ foodCount: 5 });
  const player = snake(game, 'a', [[4, 4], [3, 4], [2, 4]]);
  game.foods.splice(0, game.foods.length, { id: 'meal', x: 5, y: 4 });
  game.tick();
  assert.equal(player.snake.length, 4);
  assert.equal(player.score, 10);
  assert.equal(game.foods.length, 5);
  const occupied = new Set(player.snake.map(cellKey));
  assert.equal(new Set(game.foods.map(cellKey)).size, 5);
  for (const food of game.foods) assert.ok(!occupied.has(cellKey(food)));
});

test('food contested by a head collision is not awarded or removed', () => {
  const game = create({ foodCount: 1 });
  game.foods.splice(0, 1, { id: 'contested', x: 5, y: 4 });
  snake(game, 'a', [[4, 4], [3, 4], [2, 4]], 'right');
  snake(game, 'b', [[6, 4], [7, 4], [8, 4]], 'left');
  game.tick();
  assert.equal(game.foods[0].id, 'contested');
  assert.equal(game.players.get('a').score, 0);
  assert.equal(game.players.get('b').score, 0);
});

test('respawn preserves identity, color, and score, but resets movement and survival time', () => {
  let timestamp = 0;
  const game = create({ now: () => timestamp });
  const player = snake(game, 'a', [[11, 4], [10, 4], [9, 4]]);
  player.score = 42;
  game.tick();
  timestamp = 5000;
  const revived = game.respawn('a');
  assert.equal(revived.id, 'a');
  assert.equal(revived.color, '#fff');
  assert.equal(revived.score, 42);
  assert.equal(revived.lastScoreTime, timestamp);
  assert.equal(revived.alive, true);
  assert.deepEqual(revived.turns, []);
  game.tick();
  assert.equal(revived.score, 42);
});

test('open spawns face a long runway and can use a vertical gap', () => {
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const game = createGame({ width: 60, height: 40, foodCount: 15 });
  for (let i = 0; i < 12; i++) {
    const player = game.addPlayer(`runner-${i}`);
    assert.ok(player);
    const [dx, dy] = vectors[player.dir];
    let lead = 0;
    for (let step = 1; step <= 10; step++) {
      const ahead = { x: player.snake[0].x + dx * step, y: player.snake[0].y + dy * step };
      const blocked = ahead.x < 0 || ahead.x >= 60 || ahead.y < 0 || ahead.y >= 40
        || [...game.players.values()].some(other => other.id !== player.id && other.snake.some(segment => segment.x === ahead.x && segment.y === ahead.y));
      if (blocked) break;
      lead++;
    }
    assert.ok(lead >= 8, `spawn lead ${lead} for ${player.dir} at ${player.snake[0].x},${player.snake[0].y}`);
  }

  const fragmented = createGame({ width: 60, height: 40, foodCount: 0 });
  for (let x = 0; x < 60; x += 3) {
    const snake = [];
    for (let y = 0; y < 40; y++) snake.push({ x, y });
    fragmented.players.set(`wall-${x}`, {
      id: `wall-${x}`, name: 'wall', color: '#fff', snake, dir: 'up', turns: [], alive: true, score: 0, lastScoreTime: 0, deathTime: null,
    });
  }
  const spawned = fragmented.addPlayer('gap');
  assert.ok(spawned);
  assert.equal(spawned.snake.every(segment => segment.x % 3 !== 0), true);
});

test('frozen snakes stay still, score no survival time, and still stop other snakes', () => {
  let timestamp = 0;
  const game = create({ now: () => timestamp });
  const parked = snake(game, 'parked', [[5, 5], [5, 4], [5, 3]], 'up');
  parked.frozen = true;
  const mover = snake(game, 'mover', [[4, 5], [3, 5], [2, 5]], 'right');
  timestamp = 5000;
  const deaths = game.tick();
  assert.equal(parked.alive, true);
  assert.deepEqual(parked.snake[0], { x: 5, y: 5 });
  assert.equal(parked.score, 100);
  assert.equal(mover.alive, false);
  assert.equal(deaths[0].cause, 'body');
  assert.equal(deaths[0].scoringKill, true);
  timestamp = 9000;
  game.tick();
  assert.equal(parked.score, 100);
});
