import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGameServer } from './index.js';

test('status endpoint reports live arena metrics', async (t) => {
  const instance = createGameServer({ tickMs: 150 });
  t.after(() => instance.close());
  instance.server.listen(0, '127.0.0.1');
  await once(instance.server, 'listening');
  const port = instance.server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/snake/status`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.players, 0);
  assert.equal(body.alive, 0);
  assert.equal(body.tickMs, 150);
  assert.equal(typeof body.connections, 'number');
  assert.equal(typeof body.seq, 'number');
});
