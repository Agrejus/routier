import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { type Note, noteParser } from '../src/notes';
import { clientHeader, type RowVersion } from '../src/wire';
import type { NotePatch, NotesRepository } from './notesRepository';
import { queryEtag } from './queryEtag';
import type { Replica } from './replica';
import type { WireLog } from './wireLog';

export type LabServices = { repository: NotesRepository; replica: Replica; log: WireLog };

const patchParser = z.object({ id: z.string(), version: z.number().optional(), title: z.string().optional() });

const writeParser = z.object({
  adds: z.array(noteParser).default([]),
  updates: z.array(patchParser).default([]),
  removes: z.array(noteParser).default([]),
});

const withVersions = (patches: z.infer<typeof patchParser>[]): NotePatch[] | null =>
  patches.every(patch => patch.version != null)
    ? patches.map(patch => ({ id: patch.id, version: patch.version ?? 0, title: patch.title }))
    : null;

const versionsOf = (rows: Note[]): RowVersion[] => rows.map(row => ({ id: row.id, version: row.version }));

const clientOf = (request: Request): string => request.header(clientHeader) ?? 'unknown';

const readNotes = (services: LabServices) => async (request: Request, response: Response) => {
  const rows = services.replica.rows ?? await services.repository.all();
  const etag = queryEtag(rows);
  const ifNoneMatch = request.header('if-none-match') ?? null;
  const status = ifNoneMatch === etag ? 304 : 200;
  const source = services.replica.lagging ? 'lagging replica' : 'primary';

  services.log.record({ client: clientOf(request), method: 'GET', path: '/rest/notes', ifNoneMatch, status, etag, versions: status === 200 ? versionsOf(rows) : [], detail: source });
  response.setHeader('ETag', etag);
  response.setHeader('Cache-Control', 'no-store');

  if (status === 304) {
    response.status(304).end();
    return;
  }

  response.json(rows);
};

const writeNotes = (services: LabServices) => async (request: Request, response: Response) => {
  const record = (status: number, versions: RowVersion[], detail: string) =>
    services.log.record({ client: clientOf(request), method: 'POST', path: '/rest/notes', ifNoneMatch: null, status, etag: null, versions, detail });
  const parsed = writeParser.safeParse(request.body);

  if (!parsed.success || parsed.data.adds.length > 0 || parsed.data.removes.length > 0) {
    record(422, [], 'only edits are accepted');
    response.status(422).json({ error: 'The etag lab accepts edits only.' });
    return;
  }

  const patches = withVersions(parsed.data.updates);

  if (patches == null) {
    record(428, [], 'an edit did not say which version it was based on');
    response.status(428).json({ error: 'Each edit must carry the version it was based on.' });
    return;
  }

  const outcome = await services.repository.saveGuarded(patches);

  if (outcome.kind === 'saved') {
    record(200, versionsOf(outcome.rows), `sent ${patches.map(patch => `${patch.id}@v${patch.version}`).join(', ')}`);
    response.json({ saved: outcome.rows });
    return;
  }

  const status = outcome.kind === 'conflict' ? 409 : 500;
  record(status, [], outcome.message);
  response.status(status).json({ error: outcome.message });
};

export const createRestRouter = (services: LabServices): Router => {
  const router = Router();
  router.get('/notes', readNotes(services));
  router.post('/notes', writeNotes(services));
  return router;
};
