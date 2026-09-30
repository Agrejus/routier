import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { etags, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { FileSystemPlugin } from '../FileSystemPlugin';

const versionedSchema = s.define('versioned', {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

class VersionedStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    versioned = this.collection(versionedSchema).proxy().create();
}

describe('FileSystemPlugin etag', () => {
    it('keeps the etag it set across a reopen', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-etag-'));
        const databaseName = `db-${uuidv4()}`;
        const store = new VersionedStore(new FileSystemPlugin(root, databaseName));
        const [added] = await store.versioned.addAsync({ name: 'first' });
        await store.saveChangesAsync();

        if (added == null) {
            throw new Error('nothing was added');
        }

        added.name = 'second';
        await store.saveChangesAsync();

        const reopened = new VersionedStore(new FileSystemPlugin(root, databaseName));
        const [stored] = await reopened.versioned.toArrayAsync();
        fs.rmSync(root, { recursive: true, force: true });

        expect(stored?.version).toBe(2);
    });
});
