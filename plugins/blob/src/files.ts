import { CompiledSchema, PropertyInfo } from '@routier/core/schema';
import { blobKey, checksum, resolveContentType, resolveFileName, toBytes, type FileContent, type UploadOptions } from './content';
import { FILE_TAG, type FileReference } from './schema';
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

/**
 * Every property of a schema that holds a file reference.
 *
 * Found by tag rather than by name, so assembling the live set for a sweep does not mean
 * hard-coding which properties happen to be files. Root properties only: a reference is one
 * property, and its children are the fields inside it.
 */
export const fileProperties = <T extends {}>(schema: CompiledSchema<T>): PropertyInfo<T>[] =>
    schema.properties.filter(property =>
        property.parent == null && property.tags.includes(FILE_TAG)
    );
