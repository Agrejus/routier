import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { describePluginContract } from '@routier/test-utils';
import { PGliteDbPlugin } from '../index';
import { whenPGliteCanRun } from './vmModules';

/**
 * The shared contract, which this plugin did not run before.
 *
 * That is how it came to disagree with every other embedded plugin about what `destroy` means:
 * it inherited `@routier/postgres-plugin-core`'s server behaviour, where closing a pool is not
 * allowed to drop somebody's database, and nothing here checked.
 */

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-pglite-contract-'));

whenPGliteCanRun('plugin contract: pglite', () => describePluginContract(
    'pglite',
    () => new PGliteDbPlugin(path.join(root, uuidv4())),
    {
        // Off for the same SQL-shaped reason as MySQL and SQLite: a column either holds NULL or
        // a value, so an OPTIONAL property that was never set cannot be told apart from one set
        // to null, and the rich-type cases require that distinction to survive a round trip.
        supportsRichTypes: false,
    },
));
