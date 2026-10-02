import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import express from 'express';
import { answerErrors, handleAsync } from '../server/errors';

let origin = '';
let close: () => Promise<void> = async () => undefined;

before(async () => {
  const app = express();
  app.get('/fails', handleAsync(async () => {
    throw new Error('the store is gone');
  }));
  app.get('/works', handleAsync(async (_request, response) => {
    response.json({ ok: true });
  }));
  app.use(answerErrors);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${address != null && typeof address === 'object' ? address.port : 0}`;
  close = () => new Promise(resolve => server.close(() => resolve()));
});

after(() => close());

describe('async route errors', () => {
  it('answer 500 with the message instead of leaving the request hanging', async () => {
    mock.method(console, 'error', () => undefined);

    const response = await fetch(`${origin}/fails`, { signal: AbortSignal.timeout(5_000) });

    assert.deepEqual([response.status, await response.json()], [500, { error: 'the store is gone' }]);
  });

  it('are logged with the route that failed', async () => {
    const logged = mock.method(console, 'error', () => undefined);

    await fetch(`${origin}/fails`, { signal: AbortSignal.timeout(5_000) });

    assert.equal(logged.mock.calls[0]?.arguments[0], '[etag-lab] GET /fails failed');
  });

  it('leave a route that succeeds alone', async () => {
    const response = await fetch(`${origin}/works`);

    assert.deepEqual([response.status, await response.json()], [200, { ok: true }]);
  });
});
