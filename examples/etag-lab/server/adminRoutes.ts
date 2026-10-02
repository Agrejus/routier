import { type Request, type Response, Router } from 'express';
import { handleAsync } from './errors';
import type { LabServices } from './restRoutes';

const editNote = (services: LabServices) => async (request: Request, response: Response) => {
  const note = await services.repository.editOnServer(String(request.params.id));

  if (note == null) {
    response.status(404).json({ error: 'No such note.' });
    return;
  }

  services.log.record({ client: 'server', method: 'EDIT', path: `/notes/${note.id}`, ifNoneMatch: null, status: 200, etag: null, versions: [{ id: note.id, version: note.version }], detail: 'another user edited this note' });
  response.json(note);
};

const freezeReplica = (services: LabServices) => async (_request: Request, response: Response) => {
  services.replica.freeze(await services.repository.all());
  response.json({ lagging: true });
};

const releaseReplica = (services: LabServices) => (_request: Request, response: Response) => {
  services.replica.release();
  response.json({ lagging: false });
};

const reset = (services: LabServices) => async (_request: Request, response: Response) => {
  services.replica.release();
  await services.repository.reset();
  services.log.clear();
  response.json({ lagging: false });
};

export const createAdminRouter = (services: LabServices): Router => {
  const router = Router();
  router.get('/log', (_request, response) => response.json(services.log.list()));
  router.get('/rows', handleAsync(async (_request, response) => {
    response.json(await services.repository.all());
  }));
  router.get('/state', (_request, response) => response.json({ lagging: services.replica.lagging }));
  router.post('/notes/:id/edit', handleAsync(editNote(services)));
  router.post('/replica/freeze', handleAsync(freezeReplica(services)));
  router.post('/replica/release', releaseReplica(services));
  router.post('/reset', handleAsync(reset(services)));
  return router;
};
