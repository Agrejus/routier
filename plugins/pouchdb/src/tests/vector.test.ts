import { describeVectorSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { PouchDbPlugin } from '../PouchDbPlugin';

/**
 * PouchDB does not run `describePluginContract` — that store declares a composite key, which
 * this plugin rejects for the whole event rather than for the one collection. The vector
 * suite is deliberately independent of it so "works on every backend" can be checked here
 * too, rather than being assumed for the one backend the contract cannot reach.
 *
 * `requiresDocumentRevision` is PouchDB's write protocol, not a vector limitation: a document
 * is updated by supplying its current `_rev`, so a schema without one conflicts on the second
 * write of any property at all.
 */
describeVectorSearch(
    'pouchdb',
    () => new PouchDbPlugin(`vector-${uuidv4()}-db`),
    { requiresDocumentRevision: true },
);
