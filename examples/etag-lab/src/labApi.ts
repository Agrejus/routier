import { noteParser, notesParser } from './notes';
import { labStateParser, wireEntryParser } from './wire';

const call = async (path: string, method: 'GET' | 'POST' = 'GET') => {
  const response = await fetch(path, { method });

  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}`);
  }

  return response.json();
};

export const labApi = {
  log: async () => wireEntryParser.array().parse(await call('/admin/log')),
  serverRows: async () => notesParser.parse(await call('/admin/rows')),
  state: async () => labStateParser.parse(await call('/admin/state')),
  editOnServer: async (id: string) => noteParser.parse(await call(`/admin/notes/${id}/edit`, 'POST')),
  freezeReplica: async () => labStateParser.parse(await call('/admin/replica/freeze', 'POST')),
  releaseReplica: async () => labStateParser.parse(await call('/admin/replica/release', 'POST')),
  reset: async () => labStateParser.parse(await call('/admin/reset', 'POST')),
};
