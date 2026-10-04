import assert from 'node:assert/strict';

// Run against the Vite development server. PLAYWRIGHT_MODULE may point to an
// existing Playwright install so these regressions need no runtime dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const testUrl = process.env.GAME_TEST_URL || 'http://127.0.0.1:5173/snake/';

const browser = await chromium.launch({ headless: true });
const results = [];
const welcome = { type: 'welcome', playerId: 'p1', gridWidth: 60, gridHeight: 40,
  reconnectToken: 'token-1', alive: true, dir: 'right' };
const state = (alive = true) => ({ type: 'gameState', seq: 1, tickMs: 150,
  players: [{ id: 'p1', name: '测试蛇', color: '#aaa', snake: alive ? [{ x: 10, y: 10 }] : [], alive, dir: 'right' }],
  foods: [], scores: { p1: { name: '测试蛇', score: 10, alive } } });

async function fixture(options = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__mockSockets = [];
    class MockWebSocket {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      constructor(url, protocols) {
        if (!String(url).endsWith('/snake/ws')) return new NativeWebSocket(url, protocols);
        this.readyState = 0; this.sent = []; this.closeCalls = [];
        this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
        window.__mockSockets.push(this);
      }
      send(data) { if (this.readyState !== 1) throw new Error('closed'); this.sent.push(JSON.parse(data)); }
      close(code = 1000, reason = '') { this.closeCalls.push({ code, reason }); this.readyState = 3; this.onclose?.({ code, reason }); }
      open() { this.readyState = 1; this.onopen?.({}); }
      emit(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
      fail() { this.readyState = 3; this.onclose?.({ code: 1006, reason: '' }); }
    }
    window.WebSocket = MockWebSocket;
  });
  await page.goto(testUrl);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await page.clock.install();
  await page.evaluate(async (options) => {
    if (options.token) localStorage.setItem('snake_token', options.token);
    if (options.name) localStorage.setItem('snake_name', options.name);
    if (options.blockStorage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    const hookPath = '/snake/src/hooks/useGameConnection.ts';
    const hookSource = await (await fetch(hookPath)).text();
    const mainSource = await (await fetch('/snake/src/main.tsx')).text();
    const reactPath = hookSource.match(/from\s+"([^"]+\/react\.js[^"]*)"/)[1];
    const domPath = mainSource.match(/from\s+"([^"]+\/react-dom_client\.js[^"]*)"/)[1];
    const reactModule = await import(reactPath);
    const React = reactModule.default ?? reactModule;
    const domModule = await import(domPath);
    const createRoot = domModule.createRoot ?? domModule.default.createRoot;
    const { useGameConnection } = await import(hookPath);
    const node = document.createElement('div'); document.body.append(node);
    const root = createRoot(node);
    function Harness() { window.__connectionTest = useGameConnection(); return null; }
    root.render(React.createElement(Harness));
    window.__unmountConnection = () => root.unmount();
  }, options);
  await page.waitForFunction(() => Boolean(window.__connectionTest));
  return { page, context, errors };
}

const act = async (page, action, value) => page.evaluate(({ action, value }) => window.__connectionTest[action](value), { action, value });
const emit = async (page, value, index = -1) => page.evaluate(({ value, index }) => window.__mockSockets.at(index).emit(value), { value, index });
const open = async (page, index = -1) => page.evaluate((index) => window.__mockSockets.at(index).open(), index);
const sent = async (page, index = -1) => page.evaluate((index) => window.__mockSockets.at(index).sent, index);
const expectStatus = async (page, status) => page.waitForFunction((status) => window.__connectionTest.connectionStatus === status, status);
const snapshot = async (page) => page.evaluate(() => {
  const game = window.__connectionTest;
  return { joined: game.joined, isDead: game.isDead, respawning: game.respawning,
    status: game.connectionStatus, error: game.connectionError, playerId: game.playerId, gameState: game.gameState };
});

try {
  {
    const { page, context, errors } = await fixture();
    await act(page, 'connect', '测试蛇'); await expectStatus(page, 'connecting'); await open(page);
    assert.deepEqual(await sent(page), [{ type: 'join', playerName: '测试蛇' }]);
    await emit(page, welcome); await emit(page, state()); await expectStatus(page, 'connected');
    for (const dir of ['up', 'left', 'down', 'up', 'down']) await act(page, 'sendDirection', dir);
    assert.deepEqual((await sent(page)).filter((m) => m.type === 'direction').map((m) => m.dir), ['up', 'left', 'down', 'up', 'down']);
    await page.evaluate(() => { window.__staleMessage = window.__mockSockets[0].onmessage; });
    await page.evaluate(() => window.__mockSockets[0].fail()); await expectStatus(page, 'reconnecting');
    await page.clock.runFor(500); await open(page);
    assert.deepEqual(await sent(page), [{ type: 'rejoin', token: 'token-1' }]);
    await emit(page, { ...welcome, reconnectToken: 'token-2' }); await expectStatus(page, 'connected');
    await page.evaluate(() => window.__staleMessage({ data: JSON.stringify({ type: 'youDied', killerName: null }) }));
    assert.equal((await snapshot(page)).isDead, false);
    await act(page, 'leave'); await expectStatus(page, 'idle');
    assert.equal((await snapshot(page)).joined, false);
    assert.equal(await page.evaluate(() => localStorage.getItem('snake_token')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('snake_name')), '测试蛇');
    assert.deepEqual(await page.evaluate(() => window.__mockSockets.at(-1).closeCalls.at(-1)), { code: 4001, reason: 'leave' });
    await page.clock.runFor(20000);
    assert.equal(await page.evaluate(() => window.__mockSockets.length), 2);
    assert.deepEqual(errors, []); results.push('fresh join, rapid turns/rejection recovery, rotated reconnect token, stale socket guard, explicit leave');
    await context.close();
  }
  {
    const { page, context, errors } = await fixture({ token: 'expired', name: '保留名字' });
    await expectStatus(page, 'connecting'); await open(page);
    assert.deepEqual(await sent(page), [{ type: 'rejoin', token: 'expired' }]);
    await emit(page, { type: 'error', code: 'invalid_token' });
    assert.deepEqual(await sent(page), [{ type: 'rejoin', token: 'expired' }, { type: 'join', playerName: '保留名字' }]);
    await emit(page, { ...welcome, alive: false }); await emit(page, state(false)); await expectStatus(page, 'connected');
    assert.equal((await snapshot(page)).isDead, true);
    await act(page, 'respawn'); await page.waitForFunction(() => window.__connectionTest.respawning);
    assert.equal((await snapshot(page)).isDead, true);
    await emit(page, state(false)); assert.equal((await snapshot(page)).isDead, true);
    await emit(page, state(true)); await page.waitForFunction(() => !window.__connectionTest.isDead && !window.__connectionTest.respawning);
    assert.deepEqual(errors, []); results.push('invalid token preserves name, dead welcome, respawn waits for server confirmation');
    await context.close();
  }
  {
    const { page, context, errors } = await fixture({ blockStorage: true });
    await act(page, 'connect', '无存储蛇'); await open(page); await emit(page, welcome); await expectStatus(page, 'connected');
    await emit(page, { type: 'youDied', killerName: null }); await act(page, 'respawn');
    await page.clock.runFor(6001);
    const result = await snapshot(page);
    assert.equal(result.isDead, true); assert.equal(result.respawning, false); assert.match(result.error, /暂未确认/);
    await act(page, 'leave'); assert.deepEqual(errors, []); results.push('blocked storage still playable and respawn timeout remains dead');
    await context.close();
  }
  {
    const { page, context, errors } = await fixture();
    await act(page, 'connect', '重试蛇');
    for (const delay of [500, 1000, 2000, 4000, 8000]) {
      await page.evaluate(() => window.__mockSockets.at(-1).fail()); await expectStatus(page, 'reconnecting');
      await page.clock.runFor(delay);
    }
    await page.evaluate(() => window.__mockSockets.at(-1).fail()); await expectStatus(page, 'error');
    assert.equal(await page.evaluate(() => window.__mockSockets.length), 6);
    await page.clock.runFor(20000); assert.equal(await page.evaluate(() => window.__mockSockets.length), 6);
    await act(page, 'retry'); await expectStatus(page, 'connecting');
    assert.equal(await page.evaluate(() => window.__mockSockets.length), 7);
    assert.deepEqual(errors, []); results.push('bounded exponential retry exhaustion and manual retry');
    await context.close();
  }
  {
    const { page, context, errors } = await fixture();
    await act(page, 'connect', '超时蛇'); await page.clock.runFor(8001); await expectStatus(page, 'reconnecting');
    await page.clock.runFor(500); await open(page); await emit(page, welcome); await expectStatus(page, 'connected');
    await page.clock.runFor(18001); await expectStatus(page, 'reconnecting');
    assert.deepEqual(errors, []); results.push('handshake and silent-stream watchdog recover stalled sockets');
    await context.close();
  }
  {
    const { page, context, errors } = await fixture();
    await act(page, 'connect', '退出页面蛇'); await open(page); await emit(page, welcome); await expectStatus(page, 'connected');
    await emit(page, { type: 'youDied', killerName: null }); await act(page, 'respawn');
    await emit(page, { type: 'error', code: 'arena_full' });
    await page.waitForFunction(() => !window.__connectionTest.respawning);
    assert.equal((await snapshot(page)).isDead, true);
    assert.equal((await snapshot(page)).status, 'connected');
    await page.evaluate(() => window.__unmountConnection());
    assert.deepEqual(await page.evaluate(() => window.__mockSockets.at(-1).closeCalls.at(-1)), { code: 1000, reason: '' });
    assert.equal(await page.evaluate(() => localStorage.getItem('snake_token')), 'token-1');
    await page.clock.runFor(20000); assert.equal(await page.evaluate(() => window.__mockSockets.length), 1);
    assert.deepEqual(errors, []); results.push('spawn rejection stays dead, unmount keeps recovery token and cancels timers');
    await context.close();
  }
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally { await browser.close(); }
