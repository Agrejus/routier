import fs from 'node:fs';
import path from 'node:path';
import { afterAll } from '@jest/globals';
import { describePluginContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { FileSystemPlugin } from '../FileSystemPlugin';

const directory = `${__dirname}/../dbs`;

/** Databases copied for a reopened plugin, which the contract disposes but does not destroy. */
const copies: string[] = [];

afterAll(() => {
    for (const copy of copies) {
        fs.rmSync(copy, { recursive: true, force: true });
    }
});

describePluginContract(
    'file-system',
    () => new FileSystemPlugin(directory, `contract-${uuidv4()}-db`),
    {
        supportsRichTypes: true,
        // A copy of the database's files under a new name: collections are shared process-wide by
        // path, so a plugin over the same path would read the writer's objects instead of the file
        reopen: plugin => {
            const name = `contract-${uuidv4()}-db`;
            const copy = path.join(directory, name);
            fs.cpSync(plugin.databaseName!, copy, { recursive: true });
            copies.push(copy);
            return new FileSystemPlugin(directory, name);
        },
    },
);
