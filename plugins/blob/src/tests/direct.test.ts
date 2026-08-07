import { describe, expect, it } from '@jest/globals';
import { createDirectUploader, createFiles, memoryBlobStore } from '../index';
import type { BlobStore } from '../stores/types';

/**
 * The direct-upload handshake, both halves, with no network.
 *
 * The browser hashes, the server signs, the browser PUTs. `fetch` is injected so the whole
 * flow can be driven in-process; the same flow against a real service is in
 * `e2e/src/s3BlobStore.test.ts`.
 */

const bytesOf = (text: string) => new TextEncoder().encode(text);

/** A memory store that can also sign, standing in for S3 without any HTTP. */
const signingStore = (): BlobStore & { signed: { key: string; contentType: string }[] } => {
    const inner = memoryBlobStore();
    const signed: { key: string; contentType: string }[] = [];

    return Object.assign(inner, {
        signed,
        async uploadUrl(key: string, options: { contentType: string; checksum?: string }) {
            signed.push({ key, contentType: options.contentType });

            return {
                url: `https://storage.test/${key}`,
                headers: {
                    'content-type': options.contentType,
                    ...(options.checksum == null ? {} : { 'x-amz-checksum-sha256': options.checksum }),
                },
            };
        },
    });
};

/** A fetch that writes into the store, the way the service would. */
const uploadingFetch = (store: BlobStore) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
        const key = String(url).replace('https://storage.test/', '');
        const headers = init?.headers as Record<string, string>;

        await store.put(key, new Uint8Array(init!.body as ArrayBuffer), {
            contentType: headers['content-type'],
        });

        return { ok: true, status: 200, statusText: 'OK' } as Response;
    }) as unknown as typeof globalThis.fetch;

describe('direct upload', () => {

    it('hashes, signs and uploads, then the reference works', async () => {
        const store = signingStore();
        const files = createFiles(store);

        const uploader = createDirectUploader({
            requestUpload: request => files.createUploadUrl(request),
            fetch: uploadingFetch(store),
        });

        const reference = await uploader.upload(bytesOf('sent straight to storage'), {
            contentType: 'text/plain',
            fileName: 'note.txt',
        });

        expect(reference.size).toBe(24);
        expect(reference.fileName).toBe('note.txt');
        expect(await files.text(reference)).toBe('sent straight to storage');
    });

    it('uploads nothing when the content is already stored', async () => {
        // The payoff of content addressing on this path: re-attaching a file someone else
        // already uploaded costs zero bytes over the wire.
        const store = signingStore();
        const files = createFiles(store);

        await files.upload(bytesOf('already here'), { contentType: 'text/plain' });

        let transfers = 0;
        const uploader = createDirectUploader({
            requestUpload: request => files.createUploadUrl(request),
            fetch: (async () => { transfers++; return { ok: true } as Response; }) as never,
        });

        const reference = await uploader.upload(bytesOf('already here'), { contentType: 'text/plain' });

        expect(transfers).toBe(0);
        expect(store.signed).toHaveLength(0);
        expect(await files.text(reference)).toBe('already here');
    });

    it('signs for the key the content hashes to, not one the client names', async () => {
        const store = signingStore();
        const files = createFiles(store);

        const uploader = createDirectUploader({
            requestUpload: request => files.createUploadUrl(request),
            fetch: uploadingFetch(store),
        });

        const reference = await uploader.upload(bytesOf('addressed'), { contentType: 'text/plain' });

        expect(store.signed).toHaveLength(1);
        expect(store.signed[0].key).toBe(reference.key);
        expect(reference.key).toMatch(/^sha256\/[0-9a-f]{2}\/[0-9a-f]{64}$/);
    });

    it('sends the exact headers the signature covers', async () => {
        // A presigned URL signs its headers. A client that adds or alters one gets a 403, so
        // the uploader must pass them through untouched rather than merging its own.
        const store = signingStore();
        const files = createFiles(store);

        let sent: Record<string, string> | undefined;

        const uploader = createDirectUploader({
            requestUpload: request => files.createUploadUrl(request),
            fetch: (async (_url: unknown, init: RequestInit) => {
                sent = init.headers as Record<string, string>;
                return { ok: true, status: 200 } as Response;
            }) as never,
        });

        await uploader.upload(bytesOf('headers matter'), { contentType: 'image/png' });

        expect(sent!['content-type']).toBe('image/png');
        expect(sent!['x-amz-checksum-sha256']).toBeDefined();
    });

    it('refuses to sign a malformed digest', async () => {
        const files = createFiles(signingStore());

        await expect(files.createUploadUrl({
            checksum: 'not-a-digest', size: 1, contentType: 'text/plain', fileName: 'x',
        })).rejects.toThrow(/not a SHA-256 digest/);
    });

    it('says so when the store cannot sign uploads', async () => {
        const files = createFiles(memoryBlobStore());

        await expect(files.createUploadUrl({
            checksum: 'a'.repeat(64), size: 1, contentType: 'text/plain', fileName: 'x',
        })).rejects.toThrow(/cannot sign uploads/);
    });

    it('reports a rejected upload rather than returning a reference to nothing', async () => {
        const store = signingStore();
        const files = createFiles(store);

        const uploader = createDirectUploader({
            requestUpload: request => files.createUploadUrl(request),
            fetch: (async () => ({ ok: false, status: 403, statusText: 'Forbidden' }) as Response) as never,
        });

        await expect(uploader.upload(bytesOf('rejected'), { contentType: 'text/plain' }))
            .rejects.toThrow(/403 Forbidden/);
    });
});
