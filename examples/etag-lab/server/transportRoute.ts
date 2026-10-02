import { createRequestHandler, type IDbPlugin, type SerializedRequest } from '@routier/core/plugins';
import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { noteSchema } from '../src/notes';
import { clientHeader } from '../src/wire';
import type { WireLog } from './wireLog';
import { SchemaCollection } from '@routier/core/collections';

const requestParser = z.custom<SerializedRequest>(value => typeof value === 'object' && value != null && 'kind' in value);

export const createTransportRouter = (plugin: IDbPlugin, log: WireLog): Router => {
  const handle = createRequestHandler({ plugin, schemas: new SchemaCollection().set(noteSchema.id, noteSchema) });
  const router = Router();

  router.post('/', async (request: Request, response: Response) => {
    const client = request.header(clientHeader) ?? 'unknown';
    const parsed = requestParser.safeParse(request.body);

    if (!parsed.success) {
      log.record({ client, method: 'POST', path: '/routier', ifNoneMatch: null, status: 400, etag: null, versions: [], detail: 'not a Routier request' });
      response.status(400).json({ ok: false, error: 'Not a Routier request.' });
      return;
    }

    const answer = await handle(parsed.data, undefined);
    const status = answer.ok ? 200 : 409;
    log.record({ client, method: 'POST', path: '/routier', ifNoneMatch: null, status, etag: null, versions: [], detail: answer.ok ? parsed.data.kind : `${parsed.data.kind} refused: ${answer.error}` });
    response.status(status).json(answer);
  });

  return router;
};
