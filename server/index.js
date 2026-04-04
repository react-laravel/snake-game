import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/snake/ws' });

app.use('/snake', express.static('../client/dist'));
app.get('/health', (_, res) => res.json({ ok: true }));

const GRID_WIDTH = 60;
const GRID_HEIGHT = 40;
const TICK_MS = 150;
const FOOD_COUNT = 15;
const RECONNECT_MS = 30000;

const players = new Map();
const reconnectTokens = new Map();

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function randomPos() {
  return {
    x: Math.floor(Math.random() * GRID_WIDTH),
    y: Math.floor(Math.random() * GRID_HEIGHT),
  };
}

function spawnFood() {
  const foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    let pos;
    let attempts = 0;
    do {
      pos = randomPos();
      attempts++;
    } while (
      attempts < 100 &&
      [...players.values()].some(p => p.alive && p.snake.some(s => s.x === pos.x && s.y === pos.y))
    );
    foods.push({ id: genId(), ...pos });
  }
  return foods;
}

let foods = spawnFood();

function createSnake(id, name, color) {
  const startPos = randomPos();
  const snakeColor = color || `hsl(${hashStr(id) % 360}, 70%, 55%)`;
  return {
    id,
    name,
    snake: [
      { x: startPos.x, y: startPos.y },
      { x: startPos.x - 1, y: startPos.y },
      { x: startPos.x - 2, y: startPos.y },
    ],
    dir: 'right',
    nextDir: 'right',
    alive: true,
    score: 0,
    color: snakeColor,
    lastScoreTime: Date.now(),
    deathTime: null,
  };
}

function moveSnakes() {
  for (const player of players.values()) {
    if (!player.alive) continue;

    player.dir = player.nextDir;

    const head = { ...player.snake[0] };
    switch (player.dir) {
      case 'up':    head.y--; break;
      case 'down':  head.y++; break;
      case 'left':  head.x--; break;
      case 'right': head.x++; break;
    }

    player.snake.unshift(head);

    const ateFood = player.snake.length > 3 &&
      foods.some((f, i) => {
        if (f.x === head.x && f.y === head.y) {
          player.score += 10;
          foods.splice(i, 1);
          const newPos = randomPos();
          foods.push({ id: genId(), x: newPos.x, y: newPos.y });
          return true;
        }
        return false;
      });

    if (!ateFood) {
      player.snake.pop();
    }
  }
}

function checkCollisions() {
  const alivePlayers = [...players.values()].filter(p => p.alive);

  for (const player of alivePlayers) {
    const head = player.snake[0];

    // Wall collision
    if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT) {
      killPlayer(player, null);
      continue;
    }

    // Self collision
    for (let i = 1; i < player.snake.length; i++) {
      if (player.snake[i].x === head.x && player.snake[i].y === head.y) {
        killPlayer(player, null);
        break;
      }
    }
    if (!player.alive) continue;

    // Other players
    for (const other of alivePlayers) {
      if (other.id === player.id) continue;
      if (!other.snake || other.snake.length === 0) continue;

      // Head vs head
      const otherHead = other.snake[0];
      if (head.x === otherHead.x && head.y === otherHead.y) {
        killPlayer(player, other);
        killPlayer(other, player);
        break;
      }

      // Head vs body
      for (let i = 1; i < other.snake.length; i++) {
        if (other.snake[i].x === head.x && other.snake[i].y === head.y) {
          killPlayer(player, other);
          break;
        }
      }
    }
  }
}

function killPlayer(victim, killer) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.deathTime = Date.now();
  victim.snake = [];

  // 广播给所有其他玩家
  if (killer) {
    killer.score += 100;
    // 撞其他玩家：广播给其他人
    broadcast({ type: 'playerDied', victim: victim.id, victimName: victim.name, killer: killer.id, killerName: killer.name }, victim.id);
    // 通知死者本人
    sendTo(victim.id, { type: 'youDied', killerName: killer.name });
  }
  // 撞墙：不需要通知任何人，死者自己收到 youDied 即可
  // 单独通知死者本人（通过 playerId 定位 ws）
  if (!killer) {
    sendTo(victim.id, { type: 'youDied', killerName: null });
  }

  // 不自动重生，等待玩家点击复活
  // victim 保持 dead 状态，等待 respawn 消息
}

function scoreTick() {
  const now = Date.now();
  for (const player of players.values()) {
    if (player.alive) {
      const elapsed = Math.floor((now - player.lastScoreTime) / 1000);
      if (elapsed >= 1) {
        player.score += elapsed;
        player.lastScoreTime = now - ((now - player.lastScoreTime) % 1000);
      }
    }
  }
}

function broadcastGameState() {
  for (const p of players.values()) {
    if (p.snake.length > 3) {
      console.log(`[state] id=${p.id.slice(0,6)} name=${p.name} color=${p.color} len=${p.snake.length} alive=${p.alive}`);
    }
  }
  const state = {
    type: 'gameState',
    players: [...players.values()].map(p => ({
      id: p.id,
      name: p.name,
      snake: p.snake.map(s => ({ x: s.x, y: s.y })),
      alive: p.alive,
      color: String(p.color),
    })),
    foods,
    scores: Object.fromEntries([...players.values()].map(p => [p.id, { score: p.score, name: p.name, alive: p.alive }])),
  };
  broadcast(state);
}

function broadcast(msg, excludePlayerId = null) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      if (excludePlayerId && client.playerId === excludePlayerId) continue;
      client.send(data);
    }
  }
}

function sendTo(playerId, msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.playerId === playerId) {
      client.send(data);
      break;
    }
  }
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join') {
        // 防止同一 ws 重复创建蛇
        if (playerId && players.has(playerId)) {
          players.delete(playerId);
        }
        // 防止同名玩家重复加入（清理旧的已断开的同名玩家）
        const name = (msg.playerName || 'Player').slice(0, 20);
        for (const [existingId, existingPlayer] of players.entries()) {
          if (existingPlayer.name === name && (!existingPlayer.ws || existingPlayer.ws.readyState !== 1)) {
            players.delete(existingId);
          }
        }
        playerId = genId();
        ws.playerId = playerId;

        const player = createSnake(playerId, name);
        player.ws = ws;
        players.set(playerId, player);

        // 生成并下发 reconnect token
        const token = genId();
        reconnectTokens.set(token, { playerId, expires: Date.now() + RECONNECT_MS });
        setTimeout(() => {
          if (reconnectTokens.has(token)) reconnectTokens.delete(token);
        }, RECONNECT_MS);
        ws.send(JSON.stringify({ type: 'welcome', playerId, gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT, reconnectToken: token }));

        ws.on('close', () => {
          if (playerId && players.has(playerId)) {
            const token = genId();
            reconnectTokens.set(token, { playerId, expires: Date.now() + RECONNECT_MS });
            setTimeout(() => reconnectTokens.delete(token), RECONNECT_MS);

            setTimeout(() => {
              if (players.has(playerId)) {
                players.delete(playerId);
              }
              reconnectTokens.delete(token);
            }, RECONNECT_MS);
          }
        });
      }

      if (msg.type === 'respawn') {
        const p = players.get(playerId);
        if (p && !p.alive) {
          const color = p.color;
          console.log(`[respawn] playerId=${playerId} name=${p.name} oldColor=${p.color} newColor=${color}`);
          const newSnake = createSnake(playerId, p.name, color);
          newSnake.score = p.score;
          newSnake.ws = p.ws;
          players.set(playerId, newSnake);
          console.log(`[respawn] after set: color=${players.get(playerId)?.color}`);
        }
        return;
      }

      if (msg.type === 'rejoin') {
        const token = reconnectTokens.get(msg.token);
        if (token && Date.now() < token.expires) {
          const oldPlayer = players.get(token.playerId);
          if (oldPlayer) {
            oldPlayer.alive = true;
            oldPlayer.deathTime = null;
            oldPlayer.lastScoreTime = Date.now();
            playerId = token.playerId;
            ws.send(JSON.stringify({ type: 'welcome', playerId: token.playerId, gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT }));
            oldPlayer.ws = ws;
            ws.playerId = token.playerId;
            reconnectTokens.delete(token);
          }
        }
      }

      if (msg.type === 'direction' && playerId) {
        const player = players.get(playerId);
        if (player && player.alive) {
          const dirs = ['up', 'down', 'left', 'right'];
          if (dirs.includes(msg.dir)) {
            const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
            if (player.dir !== opposites[msg.dir]) {
              player.nextDir = msg.dir;
            }
          }
        }
      }
    } catch (e) {
      console.error('message error', e);
    }
  });
});

setInterval(() => {
  moveSnakes();
  checkCollisions();
  scoreTick();
  broadcastGameState();
}, TICK_MS);

const PORT = process.env.PORT || 3333;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Snake server running on port ${PORT}`);
});
