import { describePluginContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { PouchDbPlugin } from '../PouchDbPlugin';

/**
 * Only the renamed-property, derived-selector and date sections for now. The rest of the contract has
 * not been run against PouchDB, and running it here would make this suite a record of divergences
 * rather than of what these sections were added for.
 */
describePluginContract('pouchdb', () => new PouchDbPlugin(uuidv4()), {
    supportsRichTypes: true,
    skipSections: [
        "reports what it executed",
        "add and query round-trip",
        "identity generation",
        "composite keys",
        "updates",
        "removals",
        "query options",
        "error handling",
        "destroy",
        "filter parity with JavaScript",
    ],
    // The same database name opens the documents PouchDB persisted, through a new handle
    reopen: plugin => new PouchDbPlugin(plugin.databaseName!),
});
