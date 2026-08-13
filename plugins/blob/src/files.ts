import { blobKey, checksum, resolveContentType, resolveFileName, toBytes, type FileContent, type UploadOptions } from './content';
import { referenceFor, type UploadGrant, type UploadRequest } from './direct';
import type { FileReference } from './schema';
import type { BlobStore } from './stores/types';

/**
 * The file half of an application: upload, read back, and clean up.
 *
 * Bound to one store, and deliberately knows nothing about your database. That separation is
 * the design — metadata is a row in whatever plugin you already use, bytes are an object in
 * blob storage — and keeping the two halves unaware of each other is what lets any database
 * pair with any store.
 *
 * ```ts
 * const files = createFiles(fileSystemBlobStore('./uploads'));
 *
 * const reference = await files.upload(fileFromInput);
 * await store.documents.addAsync({ ownerId, title, file: reference });
 * await store.saveChangesAsync();
 * ```
 */
export const createFiles = (store: BlobStore) => ({
    /** The store these files live in, for callers that need to reach it directly. */
    store,

    /**
     * Uploads content and returns the reference to store on a record.
     *
     * Idempotent. The key is the SHA-256 of the bytes, so uploading the same content twice
     * writes one object and the second call skips the transfer entirely. A retry after a
     * failed save cannot produce a duplicate.
     *
     * **Upload before the save, not after.** If the save then fails, the object is an orphan:
     * it costs storage and nothing else, and `sweepOrphans` collects it. The other order
     * leaves a row pointing at bytes that were never written, which is a broken download in
     * front of a user.
     */
    async upload(content: FileContent, options: UploadOptions = {}): Promise<FileReference> {
        const bytes = await toBytes(content);
        const digest = await checksum(bytes);
        const key = blobKey(digest);
        const contentType = resolveContentType(content, options);

        // Content-addressed, so an object already at this key holds exactly these bytes.
        if (await store.has(key) === false) {
            await store.put(key, bytes, { contentType });
        }

        return {
            key,
            size: bytes.byteLength,
            contentType,
            checksum: digest,
            fileName: resolveFileName(content, options) ?? '',
        };
    },

    /**
     * Signs an upload so a client can send bytes straight to storage.
     *
     * The server half of the direct-upload flow; `createDirectUploader` is the browser half.
     * Call it from an endpoint your users are authenticated against — a presigned URL is a
     * bearer token for one object, so signing is the authorisation decision.
     *
     * Returns no URL at all when the content is already stored. Keys are content-addressed,
     * so "already stored" means the bytes are known to be identical, and the client uploads
     * nothing: re-attaching a file someone else uploaded transfers zero bytes.
     *
     * The digest the client claims is signed into the request, so the service verifies the
     * body against it. A client cannot take a URL signed for one checksum and store different
     * bytes under a key that promises to be their hash.
     *
     * Enforce your own limits before calling this — `request.size` and `request.contentType`
     * are the client's claims, and refusing to sign is how you reject an upload.
     */
    async createUploadUrl(
        request: UploadRequest,
        options: { expiresIn?: number } = {}
    ): Promise<UploadGrant> {
        if (/^[0-9a-f]{64}$/.test(request.checksum) === false) {
            throw new Error(
                `'${request.checksum}' is not a SHA-256 digest. The key is derived from it, ` +
                'so a malformed digest would sign a URL for a key that means nothing.'
            );
        }

        const reference = referenceFor(request);

        if (await store.has(reference.key)) {
            return { reference };
        }

        if (store.uploadUrl == null) {
            throw new Error(
                `The ${store.name} blob store cannot sign uploads, so bytes cannot be sent to ` +
                'it directly. Upload through your server with `upload()` instead.'
            );
        }

        const upload = await store.uploadUrl(reference.key, {
            contentType: request.contentType,
            checksum: request.checksum,
            expiresIn: options.expiresIn,
        });

        return { upload, reference };
    },

    /** Reads the bytes for a reference. */
    async bytes(reference: FileReference): Promise<Uint8Array> {
        return store.get(reference.key);
    },

    /** Reads the bytes and decodes them as UTF-8 text. */
    async text(reference: FileReference): Promise<string> {
        return new TextDecoder().decode(await store.get(reference.key));
    },

    /**
     * A URL a browser can fetch directly, when the store can issue one.
     *
     * Throws for a store that cannot, rather than returning something that will not work.
     */
    async url(reference: FileReference, options?: { expiresIn?: number }): Promise<string> {
        if (store.url == null) {
            throw new Error(
                `The ${store.name} blob store cannot issue URLs. Read the bytes with ` +
                '`bytes()` and serve them yourself, or use a store that signs URLs.'
            );
        }

        return store.url(reference.key, options);
    },

    /**
     * Deletes every object the given references do **not** cover.
     *
     * This exists because keys are content-addressed, and that has a consequence worth being
     * blunt about: **two records can reference the same object**, so removing a record must
     * never delete its bytes. Nothing here deletes on remove. Storage is reclaimed only by
     * this sweep, run when you choose, against the full set of references your database
     * currently holds.
     *
     * Get that set wrong and you delete live data. So it takes the references rather than
     * discovering them, the caller assembles them from a query they can reason about, and a
     * sweep with an empty set refuses to run — an empty set almost always means the query
     * failed, not that every file is garbage.
     */
    async sweepOrphans(
        live: Iterable<Pick<FileReference, 'key'>>,
        options: { allowEmpty?: boolean; dryRun?: boolean } = {}
    ): Promise<{ deleted: string[]; kept: number }> {
        if (store.list == null) {
            throw new Error(`The ${store.name} blob store cannot list keys, so it cannot be swept.`);
        }

        const keep = new Set([...live].map(reference => reference.key));

        if (keep.size === 0 && options.allowEmpty !== true) {
            throw new Error(
                'sweepOrphans was given no live references, which would delete every object ' +
                'in the store. That is almost always a failed query rather than an empty ' +
                'database. Pass `{ allowEmpty: true }` if you genuinely mean it.'
            );
        }

        const deleted: string[] = [];

        for await (const key of store.list('sha256/')) {
            if (keep.has(key)) {
                continue;
            }

            if (options.dryRun !== true) {
                await store.delete(key);
            }

            deleted.push(key);
        }

        return { deleted, kept: keep.size };
    },
});

export type Files = ReturnType<typeof createFiles>;
