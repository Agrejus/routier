import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { type Note, notesParser } from '../src/notes';
import { clientHeader, wireEntryParser } from '../src/wire';
import { type LabServer, startLabServer } from './labServer';

let lab: LabServer;

const headers = { 'Content-Type': 'application/json', [clientHeader]: 'test' };

const readNotes = (ifNoneMatch?: string) => fetch(`${lab.origin}/rest/notes`, { headers: ifNoneMatch == null ? headers : { ...headers, 'If-None-Match': ifNoneMatch } });

const rows = async (): Promise<Note[]> => notesParser.parse(await (await readNotes()).json());

const post = (path: string, body: object = {}) => fetch(`${lab.origin}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

const note = async (id: string): Promise<Note> => {
  const found = (await rows()).find(row => row.id === id);
  assert.ok(found, `no note ${id}`);
  return found;
};

beforeEach(async () => {
  lab = await startLabServer();
});

afterEach(async () => {
  await lab.stop();
});

describe('reading notes', () => {
  it('serves the seeded notes at version 1, sorted by id', async () => {
    assert.deepEqual((await rows()).map(row => [row.id, row.version]), [['launch', 1], ['retro', 1], ['roadmap', 1]]);
  });

  it('tells the browser not to cache, since the client keeps its own cache', async () => {
    assert.equal((await readNotes()).headers.get('Cache-Control'), 'no-store');
  });

  it('answers 304 when the etag the client sends still matches', async () => {
    const etag = (await readNotes()).headers.get('ETag') ?? '';

    assert.equal((await readNotes(etag)).status, 304);
  });

  it('answers 200 with a new etag after another user edits a note', async () => {
    const etag = (await readNotes()).headers.get('ETag') ?? '';
    await post('/admin/notes/launch/edit');

    const response = await readNotes(etag);

    assert.deepEqual([response.status, response.headers.get('ETag') === etag], [200, false]);
  });

  it('serves the frozen rows while the replica lags', async () => {
    await post('/admin/replica/freeze');
    await post('/admin/notes/launch/edit');

    assert.equal((await note('launch')).version, 1);
  });

  it('serves the primary again once the replica is released', async () => {
    await post('/admin/replica/freeze');
    await post('/admin/notes/launch/edit');
    await post('/admin/replica/release');

    assert.equal((await note('launch')).version, 2);
  });
});

describe('writing notes', () => {
  it('saves an edit made at the current version and returns the next version', async () => {
    const current = await note('roadmap');

    const response = await post('/rest/notes', { updates: [{ ...current, title: 'Edited' }] });

    assert.deepEqual([response.status, await response.json()], [200, { saved: [{ id: 'roadmap', title: 'Edited', version: 2 }] }]);
  });

  it('refuses an edit made at a stale version with 409', async () => {
    const stale = await note('roadmap');
    await post('/admin/notes/roadmap/edit');

    const response = await post('/rest/notes', { updates: [{ ...stale, title: 'Edited' }] });

    assert.deepEqual([response.status, (await note('roadmap')).version], [409, 2]);
  });

  it('applies a partial edit onto the stored row', async () => {
    const response = await post('/rest/notes', { updates: [{ id: 'retro', version: 1, title: 'Patched' }] });

    assert.deepEqual([response.status, await note('retro')], [200, { id: 'retro', title: 'Patched', version: 2 }]);
  });

  it('refuses an edit that does not say which version it was based on with 428', async () => {
    const response = await post('/rest/notes', { updates: [{ id: 'retro', title: 'Patched' }] });

    assert.deepEqual([response.status, (await note('retro')).title], [428, 'Sprint retro']);
  });

  it('refuses an edit of a note that no longer exists with 409', async () => {
    const response = await post('/rest/notes', { updates: [{ id: 'gone', version: 1, title: 'Patched' }] });

    assert.equal(response.status, 409);
  });

  it('refuses adds with 422', async () => {
    const response = await post('/rest/notes', { adds: [{ id: 'new', title: 'New', version: 1 }] });

    assert.equal(response.status, 422);
  });

  it('refuses a body that is not a list of edits with 422', async () => {
    const response = await post('/rest/notes', { updates: [{ title: 'no id' }] });

    assert.equal(response.status, 422);
  });

  it('answers 404 for a server edit of an unknown note', async () => {
    assert.equal((await post('/admin/notes/missing/edit')).status, 404);
  });
});

describe('the wire log', () => {
  it('records the etag sent, the status, and the versions returned', async () => {
    const etag = (await readNotes()).headers.get('ETag') ?? '';
    await readNotes(etag);

    const log = wireEntryParser.array().parse(await (await fetch(`${lab.origin}/admin/log`)).json());

    assert.deepEqual(log.map(entry => [entry.client, entry.status, entry.ifNoneMatch, entry.versions.length]), [['test', 200, null, 3], ['test', 304, etag, 0]]);
  });

  it('is emptied by a reset, which also restores the seed', async () => {
    await post('/admin/notes/launch/edit');

    await post('/admin/reset');

    const log = wireEntryParser.array().parse(await (await fetch(`${lab.origin}/admin/log`)).json());
    assert.deepEqual([log.length, (await note('launch')).version], [0, 1]);
  });
});
