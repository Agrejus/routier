import { afterEach, describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import type { IDbPlugin } from '@routier/core/plugins';
import { createFiles, fileProperties, fileRef, memoryBlobStore } from '../index';

/**
 * Metadata in the database, bytes in the blob store.
 *
 * Everything here runs against both an in-process database and IndexedDB, with a blob store in
 * a Map — no cloud account, no container, no credentials. The point of the driver interface is
 * that the S3 store passes the same tests; the point of running two databases is that the two
 * halves are genuinely independent.
 */

const documentSchema = s.define('documents', {
    id: s.string().key().identity(),
    ownerId: s.string().index(),
    title: s.string(),
    file: fileRef(),
}).compile();

class DocumentStore extends DataStore {
    documents = this.collection(documentSchema).proxy().create();
}

const stores: DataStore[] = [];

const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

/** The two databases a file reference has to survive: in-process, and IndexedDB. */
const databases: [string, () => IDbPlugin][] = [
    ['memory', () => new MemoryPlugin(`blob-${uuidv4()}`)],
    ['dexie', () => new DexiePlugin(`blob-${uuidv4()}`)],
];

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('files', () => {

    describe.each(databases)('with the %s database', (_name, plugin) => {

        it('stores the reference on the row and the bytes in the store', async () => {
            const files = createFiles(memoryBlobStore());
            const store = track(new DocumentStore(plugin()));

            const reference = await files.upload(bytesOf('a report'), {
                contentType: 'application/pdf',
                fileName: 'q3.pdf',
            });

            await store.documents.addAsync({ ownerId: 'user-1', title: 'Q3', file: reference } as never);
            await store.saveChangesAsync();

            const [saved] = await store.documents.toArrayAsync();

            expect(saved.file).toEqual(reference);
            expect(saved.file.size).toBe(8);
            expect(saved.file.contentType).toBe('application/pdf');
            expect(saved.file.fileName).toBe('q3.pdf');

            // The bytes never went near the row.
            expect(await files.text(saved.file)).toBe('a report');
        });

        it('queries metadata without touching the blob store', async () => {
            // The whole reason metadata lives in the database. A store that throws on read
            // proves the query never reached it.
            const backing = memoryBlobStore();
            const files = createFiles(backing);
            const store = track(new DocumentStore(plugin()));

            const small = await files.upload(bytesOf('x'), { contentType: 'text/plain' });
            const large = await files.upload(bytesOf('x'.repeat(5000)), { contentType: 'application/pdf' });

            await store.documents.addAsync({ ownerId: 'user-1', title: 'note', file: small } as never);
            await store.documents.addAsync({ ownerId: 'user-1', title: 'report', file: large } as never);
            await store.saveChangesAsync();

            backing.get = () => { throw new Error('the query read the blob store'); };

            const mine = await store.documents
                .where(([d, p]) => d.ownerId === p.owner, { owner: 'user-1' })
                .toArrayAsync();

            expect(mine).toHaveLength(2);
            expect(mine.map(d => d.file.size).sort((a, b) => a - b)).toEqual([1, 5000]);
        });

        it('survives two file properties on one schema', async () => {
            // `original` and `thumbnail` share child names, which is what made Dexie refuse to
            // open a database before known defect #60.
            const assetSchema = s.define('assets', {
                id: s.string().key().identity(),
                original: fileRef(),
                thumbnail: fileRef(),
            }).compile();

            class AssetStore extends DataStore {
                assets = this.collection(assetSchema).proxy().create();
            }

            const files = createFiles(memoryBlobStore());
            const assets = track(new AssetStore(plugin()));

            const original = await files.upload(bytesOf('full size'), { contentType: 'image/png' });
            const thumbnail = await files.upload(bytesOf('thumb'), { contentType: 'image/png' });

            await assets.assets.addAsync({ original, thumbnail } as never);
            await assets.saveChangesAsync();

            const [saved] = await assets.assets.toArrayAsync();

            expect(saved.original.checksum).not.toBe(saved.thumbnail.checksum);
            expect(await files.text(saved.original)).toBe('full size');
            expect(await files.text(saved.thumbnail)).toBe('thumb');
        });
    });

    describe('content addressing', () => {

        it('uploads identical content once', async () => {
            const backing = memoryBlobStore();
            const files = createFiles(backing);

            let writes = 0;
            const put = backing.put.bind(backing);
            backing.put = (...args) => { writes++; return put(...args); };

            const first = await files.upload(bytesOf('same bytes'), { contentType: 'text/plain' });
            const second = await files.upload(bytesOf('same bytes'), { contentType: 'text/plain' });

            expect(first.key).toBe(second.key);
            expect(writes).toBe(1);
        });

        it('gives different content different keys', async () => {
            const files = createFiles(memoryBlobStore());

            const a = await files.upload(bytesOf('one'), { contentType: 'text/plain' });
            const b = await files.upload(bytesOf('two'), { contentType: 'text/plain' });

            expect(a.key).not.toBe(b.key);
        });

        it('hashes a subarray as itself, not as the buffer it came from', async () => {
            // A Uint8Array can be a window into a larger allocation. Hashing the underlying
            // buffer would give a subarray its parent's checksum — and therefore its key,
            // and therefore its content.
            const files = createFiles(memoryBlobStore());
            const parent = bytesOf('HEADERbody');
            const child = parent.subarray(6);

            const whole = await files.upload(parent, { contentType: 'text/plain' });
            const part = await files.upload(child, { contentType: 'text/plain' });

            expect(part.key).not.toBe(whole.key);
            expect(part.size).toBe(4);
            expect(await files.text(part)).toBe('body');
        });

        it('takes the content type from a Blob when one is not given', async () => {
            const files = createFiles(memoryBlobStore());
            const reference = await files.upload(new Blob(['hi'], { type: 'text/html' }));

            expect(reference.contentType).toBe('text/html');
        });
    });

    describe('sweeping orphans', () => {

        it('deletes what no record references and keeps what does', async () => {
            const files = createFiles(memoryBlobStore());
            const store = track(new DocumentStore(new MemoryPlugin(`sweep-${uuidv4()}`)));

            const kept = await files.upload(bytesOf('referenced'), { contentType: 'text/plain' });
            const orphan = await files.upload(bytesOf('abandoned'), { contentType: 'text/plain' });

            await store.documents.addAsync({ ownerId: 'u', title: 't', file: kept } as never);
            await store.saveChangesAsync();

            const live = (await store.documents.toArrayAsync()).map(d => d.file);
            const result = await files.sweepOrphans(live);

            expect(result.deleted).toEqual([orphan.key]);
            expect(result.kept).toBe(1);
            expect(await files.text(kept)).toBe('referenced');
        });

        it('refuses to run with no live references', async () => {
            // An empty set means "delete everything". It is almost always a failed query.
            const files = createFiles(memoryBlobStore());
            await files.upload(bytesOf('precious'), { contentType: 'text/plain' });

            await expect(files.sweepOrphans([])).rejects.toThrow(/no live references/);
        });

        it('runs on an empty set when told to explicitly', async () => {
            const files = createFiles(memoryBlobStore());
            const reference = await files.upload(bytesOf('gone'), { contentType: 'text/plain' });

            const result = await files.sweepOrphans([], { allowEmpty: true });

            expect(result.deleted).toEqual([reference.key]);
        });

        it('reports without deleting on a dry run', async () => {
            const files = createFiles(memoryBlobStore());
            const reference = await files.upload(bytesOf('still here'), { contentType: 'text/plain' });

            const result = await files.sweepOrphans([], { allowEmpty: true, dryRun: true });

            expect(result.deleted).toEqual([reference.key]);
            expect(await files.text(reference)).toBe('still here');
        });

        it('keeps an object two records share', async () => {
            // The consequence of content addressing: removing one record must not delete
            // bytes another still points at.
            const files = createFiles(memoryBlobStore());
            const store = track(new DocumentStore(new MemoryPlugin(`shared-${uuidv4()}`)));

            const shared = await files.upload(bytesOf('one copy'), { contentType: 'text/plain' });

            await store.documents.addAsync({ ownerId: 'a', title: 'first', file: shared } as never);
            await store.documents.addAsync({ ownerId: 'b', title: 'second', file: shared } as never);
            await store.saveChangesAsync();

            const all = await store.documents.toArrayAsync();
            const [first] = all;

            await store.documents.removeAsync(first as never);
            await store.saveChangesAsync();

            const live = (await store.documents.toArrayAsync()).map(d => d.file);
            const result = await files.sweepOrphans(live);

            expect(result.deleted).toEqual([]);
            expect(await files.text(shared)).toBe('one copy');
        });
    });

    describe('finding file properties on a schema', () => {

        it('finds them by tag, not by name', () => {
            const found = fileProperties(documentSchema as never).map(p => p.name);

            expect(found).toEqual(['file']);
        });

        it('finds several, and no plain object', () => {
            const mixed = s.define('mixed', {
                id: s.string().key().identity(),
                attachment: fileRef(),
                preview: fileRef(),
                settings: s.object({ theme: s.string() }),
            }).compile();

            expect(fileProperties(mixed as never).map(p => p.name)).toEqual(['attachment', 'preview']);
        });
    });

    describe('a store that cannot sign URLs', () => {

        it('says so instead of returning one that will not work', async () => {
            const files = createFiles(memoryBlobStore());
            const reference = await files.upload(bytesOf('x'), { contentType: 'text/plain' });

            await expect(files.url(reference)).rejects.toThrow(/cannot issue URLs/);
        });
    });
});
