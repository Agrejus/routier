import { describePluginContract } from '@routier/test-utils';
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '../index';
import { tursoDriver } from '../drivers/turso';

/**
 * The same plugin contract, run against a real libSQL client.
 *
 * `tursoDriver.test.ts` proves the driver ROUTES statements correctly, against a recording
 * fake. It cannot prove libSQL accepts what the plugin emits, and that is a separate question:
 * libSQL is a SQLite fork with its own client, its own parameter binding, and its own result
 * shape. Running the whole contract is the only way to find where those disagree — the same
 * argument `driverParity.test.ts` makes about `sqlite3` versus `node:sqlite`, and the reason
 * that file exists at all.
 *
 * A local `file:` URL, so this needs no account, no network, and no container — the one
 * property that made Turso the cheap half of the D1 spike. It does mean the HTTP transport
 * itself is untested here, and that is where the interactive-transaction mapping actually
 * earns its keep. See `specs/plugin-roadmap.md`.
 */

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-turso-'));

describePluginContract(
    'sqlite (turso driver, local file)',
    () => {
        const file = path.join(directory, `${uuidv4()}.sqlite`);
        const client = createClient({ url: `file:${file}` });

        return new SqliteDbPlugin(file, {
            driver: tursoDriver(client, {
                // The teardown the driver refuses to guess at. Safe here because this URL is
                // known to be a local file.
                deleteDatabase: async () => {
                    client.close();

                    await fs.promises.unlink(file).catch((error: NodeJS.ErrnoException) => {
                        if (error.code !== 'ENOENT') {
                            throw error;
                        }
                    });
                },
            }),
        });
    },
    {
        // Same reasoning as contract.test.ts: SQLite has no native boolean, date, array or
        // object column type, and libSQL inherits that.
        supportsRichTypes: false,
        knownFailing: [],
    },
);

