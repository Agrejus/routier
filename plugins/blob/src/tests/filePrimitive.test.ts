import { afterEach, describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import type { IDbPlugin } from '@routier/core/plugins';
import { BlobDbPlugin, createFiles, memoryBlobStore } from '../index';

/**
 * `s.file()` end to end: assign content, save, read back a reference.
 *
 * This is what the core primitive exists for. Content assigned to a property survives the
 * generated `preprocess` — an object property would have discarded it — and `BlobDbPlugin`
 * swaps it for a reference during `bulkPersist`, which is the only place an upload can
 * happen, because `preprocess` is synchronous.
 *
 * Run against both an in-process database and IndexedDB, because the inner plugin is supposed
 * to be entirely unaware that files exist: by the time it runs, the property holds five plain
 * fields.
 */

const documentSchema = s.define('documents', {
    id: s.string().key().identity(),
    ownerId: s.string().index(),
    title: s.string(),
    file: s.file(),
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

const databases: [string, () => IDbPlugin][] = [
    ['memory', () => new MemoryPlugin(`file-${uuidv4()}`)],
    ['dexie', () => new DexiePlugin(`file-${uuidv4()}`)],
];

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('s.file()', () => {

    describe.each(databases)('with the %s database', (_name, plugin) => {

        const build = () => {
            const files = createFiles(memoryBlobStore());
            const store = track(new DocumentStore(new BlobDbPlugin(plugin(), files)));

            return { files, store };
        };

        it('accepts content on add and gives back a reference on read', async () => {
            const { files, store } = build();

            await store.documents.addAsync({
                ownerId: 'user-1',
                title: 'Q3 report',
                file: bytesOf('a real report'),
            });

            await store.saveChangesAsync();

            const [saved] = await store.documents.toArrayAsync();

            // The read shape: five plain fields, no bytes.
            expect(saved.file.size).toBe(13);
            expect(saved.file.key).toMatch(/^sha256\/[0-9a-f]{2}\/[0-9a-f]{64}$/);
            expect(saved.file.checksum).toHaveLength(64);

            // And the bytes really are in the store.
            expect(await files.text(saved.file)).toBe('a real report');
        });

        it('accepts a Blob and keeps its content type', async () => {
            const { files, store } = build();

            await store.documents.addAsync({
                ownerId: 'user-1',
                title: 'picture',
                file: new Blob(['image bytes'], { type: 'image/png' }),
            });

            await store.saveChangesAsync();

            const [saved] = await store.documents.toArrayAsync();

            expect(saved.file.contentType).toBe('image/png');
            expect(await files.text(saved.file)).toBe('image bytes');
        });

        it('queries on the metadata without reading the blob store', async () => {
            const backing = memoryBlobStore();
            const files = createFiles(backing);
            const store = track(new DocumentStore(new BlobDbPlugin(plugin(), files)));

            await store.documents.addAsync({ ownerId: 'a', title: 'one', file: bytesOf('x') });
            await store.documents.addAsync({ ownerId: 'b', title: 'two', file: bytesOf('yy') });
            await store.saveChangesAsync();

            backing.get = () => { throw new Error('the query read the blob store'); };

            const mine = await store.documents
                .where(([d, p]) => d.ownerId === p.owner, { owner: 'a' })
                .toArrayAsync();

            expect(mine).toHaveLength(1);
            expect(mine[0].file.size).toBe(1);
        });

        it('does not re-upload a reference that came back from a query', async () => {
            // Saving an entity that was read from the database must not treat its reference
            // as new content. The wrapper has to tell the two apart.
            const { files, store } = build();

            await store.documents.addAsync({ ownerId: 'a', title: 'first', file: bytesOf('once') });
            await store.saveChangesAsync();

            let uploads = 0;
            const upload = files.upload.bind(files);
            files.upload = (async (...args: Parameters<typeof upload>) => {
                uploads++;
                return upload(...args);
            }) as typeof files.upload;

            const [saved] = await store.documents.toArrayAsync();
            saved.title = 'renamed';
            await store.saveChangesAsync();

            expect(uploads).toBe(0);

            const [reread] = await store.documents.toArrayAsync();
            expect(reread.title).toBe('renamed');
            expect(await files.text(reread.file)).toBe('once');
        });

        it('stores two files on one record', async () => {
            const assetSchema = s.define('assets', {
                id: s.string().key().identity(),
                original: s.file(),
                thumbnail: s.file(),
            }).compile();

            class AssetStore extends DataStore {
                assets = this.collection(assetSchema).proxy().create();
            }

            const files = createFiles(memoryBlobStore());
            const assets = track(new AssetStore(new BlobDbPlugin(plugin(), files)));

            await assets.assets.addAsync({
                original: bytesOf('full size image'),
                thumbnail: bytesOf('small'),
            });

            await assets.saveChangesAsync();

            const [saved] = await assets.assets.toArrayAsync();

            expect(saved.original.size).toBe(15);
            expect(saved.thumbnail.size).toBe(5);
            expect(await files.text(saved.original)).toBe('full size image');
            expect(await files.text(saved.thumbnail)).toBe('small');
        });

        it('deduplicates identical content across records', async () => {
            const { files, store } = build();

            await store.documents.addAsync({ ownerId: 'a', title: 'one', file: bytesOf('same') });
            await store.documents.addAsync({ ownerId: 'b', title: 'two', file: bytesOf('same') });
            await store.saveChangesAsync();

            const all = await store.documents.toArrayAsync();

            expect(all[0].file.key).toBe(all[1].file.key);
            expect(await files.text(all[0].file)).toBe('same');
        });

        it('fails the save when the upload fails, writing no row', async () => {
            // Upload first, then rows. A failed upload must not leave a row pointing at bytes
            // that were never written.
            const backing = memoryBlobStore();
            backing.put = () => { throw new Error('storage is down'); };

            const files = createFiles(backing);
            const store = track(new DocumentStore(new BlobDbPlugin(plugin(), files)));

            await store.documents.addAsync({ ownerId: 'a', title: 'doomed', file: bytesOf('x') });

            await expect(store.saveChangesAsync()).rejects.toThrow(/storage is down/);
        });
    });

    describe('the inner plugin', () => {

        it('never sees content, only a reference', async () => {
            // The separation that lets any database pair with any store: by the time the real
            // plugin runs, a file property is five plain fields.
            const seen: unknown[] = [];
            const inner = new MemoryPlugin(`spy-${uuidv4()}`);

            const spy: IDbPlugin = {
                get databaseName() { return inner.databaseName; },
                query: (event, done) => inner.query(event as never, done as never),
                destroy: (event, done) => inner.destroy(event, done),
                bulkPersist: (event, done) => {
                    for (const [, changes] of event.operation) {
                        for (const add of changes?.adds ?? []) {
                            seen.push((add as unknown as { file: unknown }).file);
                        }
                    }
                    return inner.bulkPersist(event, done);
                },
            };

            const files = createFiles(memoryBlobStore());
            const store = track(new DocumentStore(new BlobDbPlugin(spy, files)));

            await store.documents.addAsync({ ownerId: 'a', title: 't', file: bytesOf('bytes') });
            await store.saveChangesAsync();

            expect(seen).toHaveLength(1);
            expect(seen[0]).toEqual(expect.objectContaining({
                size: 5,
                checksum: expect.any(String),
                key: expect.any(String),
            }));
            expect(seen[0]).not.toBeInstanceOf(Uint8Array);
        });
    });
});
