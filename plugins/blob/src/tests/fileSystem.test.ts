import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFiles } from '../index';
import { fileSystemBlobStore } from '../stores/fileSystem';

/**
 * The filesystem store against a real directory.
 *
 * `memoryBlobStore` proves the plugin's logic; this proves that the interface survives contact
 * with something that has directories, partial writes and a root to escape from. An S3 store
 * has to pass the same set.
 */

const roots: string[] = [];

const root = () => {
    const created = mkdtempSync(join(tmpdir(), 'routier-blobs-'));
    roots.push(created);
    return created;
};

afterEach(() => {
    for (const directory of roots.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('the filesystem blob store', () => {

    it('round-trips content through a real directory', async () => {
        const files = createFiles(fileSystemBlobStore(root()));

        const reference = await files.upload(bytesOf('on disk'), { contentType: 'text/plain' });

        expect(await files.text(reference)).toBe('on disk');
        expect(reference.size).toBe(7);
    });

    it('writes the object at its content address', async () => {
        const directory = root();
        const files = createFiles(fileSystemBlobStore(directory));

        const reference = await files.upload(bytesOf('addressed'), { contentType: 'text/plain' });

        // The key is a path under the root, and the bytes are exactly what was uploaded.
        expect(readFileSync(join(directory, reference.key), 'utf8')).toBe('addressed');
    });

    it('reports a missing key rather than returning empty content', async () => {
        const files = createFiles(fileSystemBlobStore(root()));

        await expect(files.bytes({ key: 'sha256/aa/missing', size: 0, contentType: '', checksum: '', fileName: '' }))
            .rejects.toThrow();
    });

    it('refuses a key that escapes the root', async () => {
        // Keys are generated, not typed by a user, but this is the one place a bad one could
        // write outside the store.
        const store = fileSystemBlobStore(root());

        await expect(store.put('../escaped', bytesOf('x'), { contentType: 'text/plain' }))
            .rejects.toThrow(/outside the store root/);
    });

    it('lists nothing for a store that was never written to', async () => {
        const store = fileSystemBlobStore(join(root(), 'not-created-yet'));
        const keys: string[] = [];

        for await (const key of store.list!('sha256/')) {
            keys.push(key);
        }

        expect(keys).toEqual([]);
    });

    it('ignores a partial write when listing', async () => {
        // A crash mid-write leaves a `.partial` file. It is not an object and must never be
        // reported as one, or a sweep would try to delete a key that does not exist.
        const directory = root();
        const files = createFiles(fileSystemBlobStore(directory));
        const reference = await files.upload(bytesOf('real'), { contentType: 'text/plain' });

        mkdirSync(join(directory, 'sha256/zz'), { recursive: true });
        writeFileSync(join(directory, 'sha256/zz/abandoned.partial'), 'half a file');

        const result = await files.sweepOrphans([reference], { dryRun: true });

        expect(result.deleted).toEqual([]);
    });

    it('sweeps an orphan off disk', async () => {
        const directory = root();
        const files = createFiles(fileSystemBlobStore(directory));

        const kept = await files.upload(bytesOf('keep me'), { contentType: 'text/plain' });
        const orphan = await files.upload(bytesOf('drop me'), { contentType: 'text/plain' });

        const result = await files.sweepOrphans([kept]);

        expect(result.deleted).toEqual([orphan.key]);
        expect(await files.text(kept)).toBe('keep me');
        await expect(files.bytes(orphan)).rejects.toThrow();
    });

    it('cannot issue URLs and says so', async () => {
        const files = createFiles(fileSystemBlobStore(root()));
        const reference = await files.upload(bytesOf('x'), { contentType: 'text/plain' });

        await expect(files.url(reference)).rejects.toThrow(/cannot issue URLs/);
    });
});
