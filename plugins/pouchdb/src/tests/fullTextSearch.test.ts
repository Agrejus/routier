import { describeFullTextSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { PouchDbPlugin } from '../PouchDbPlugin';

/**
 * `requiresDocumentRevision` is PouchDB's write protocol showing through: a document is updated
 * by supplying its current `_rev`, so a schema that declares one lets a caller hold the value
 * and skip the lookup the plugin would otherwise do.
 *
 * It is no longer REQUIRED — see `_withRevisions` in the plugin. The generated search index is
 * what proved it had to stop being required: its rows are built from the document being saved,
 * so they carry an id and never a revision, and every edit to an indexed document used to fail
 * with a conflict whose only detail was `true`.
 */
describeFullTextSearch(
    'pouchdb',
    () => new PouchDbPlugin(`fts-${uuidv4()}-db`),
    { requiresDocumentRevision: true },
);
