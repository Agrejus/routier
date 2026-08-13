import { blobKey, checksum, resolveContentType, resolveFileName, toBytes, type FileContent, type UploadOptions } from './content';
import type { FileReference } from './schema';

/**
 * Direct upload: the browser sends bytes to storage, not to your server.
 *
 * Your API signs a URL and returns it. The browser PUTs to S3, R2 or GCS. A ten-gigabyte
 * upload costs your server one small JSON response, and your API never holds the bytes, never
 * buffers them, and never becomes the bottleneck.
 *
 * The two halves live in different processes, so they are two functions:
 *
 * ```ts
 * // --- your server, where the credentials are ---
 * const files = createFiles(s3BlobStore({ bucket, client }));
 *
 * app.post('/uploads', async (request, response) => {
 *     response.json(await files.createUploadUrl(request.body));
 * });
 *
 * // --- the browser, which has none ---
 * const uploader = createDirectUploader({
 *     requestUpload: (descriptor) =>
 *         fetch('/uploads', {
 *             method: 'POST',
 *             headers: { 'content-type': 'application/json' },
 *             body: JSON.stringify(descriptor),
 *         }).then(response => response.json()),
 * });
 *
 * const reference = await uploader.upload(fileFromInput);
 *
 * await store.documents.addAsync({ ownerId, title, file: reference });
 * await store.saveChangesAsync();
 * ```
 *
 * ## Why the browser hashes first
 *
 * Keys are content-addressed, so the key cannot be chosen until the content is known. The
 * browser hashes locally with `crypto.subtle` and sends the digest, the size and the content
 * type; the server signs a URL for that exact key.
 *
 * That ordering pays for itself: the server can answer "already stored" for content it
 * already has, and the browser then uploads **nothing at all**. Re-attaching a file someone
 * else already uploaded transfers zero bytes.
 *
 * ## What stops a client lying about the digest
 *
 * Nothing, on its own — so the signature carries the digest. The server signs
 * `x-amz-checksum-sha256`, the service verifies the body against it, and a PUT whose bytes do
 * not match the claimed hash is rejected by the service rather than trusted. Without that, a
 * client could take a URL signed for one checksum and store different bytes under a key that
 * promises to be their hash.
 *
 * Sign for authenticated users only, and keep `expiresIn` short: a presigned URL is a bearer
 * token for one object.
 */

/** What the browser tells the server about content it wants to upload. */
export type UploadRequest = {
    /** SHA-256 of the content, lowercase hex. Determines the key. */
    checksum: string;
    /** Byte length. Check it server-side before signing if you enforce a limit. */
    size: number;
    /** Media type. Signed into the URL, so the PUT must send exactly this. */
    contentType: string;
    /** Display name. Metadata only; it is not part of the key. */
    fileName: string;
};

/** What the server sends back. */
export type UploadGrant = {
    /**
     * Where to PUT, and what headers to send. Absent when the content is already stored,
     * which is the case worth having: nothing is transferred.
     */
    upload?: { url: string; headers: Record<string, string> };

    /** The reference to store on a record, whether or not an upload was needed. */
    reference: FileReference;
};

export type DirectUploaderOptions = {
    /** Asks your server to sign an upload. Usually one `fetch`. */
    requestUpload: (request: UploadRequest) => Promise<UploadGrant>;

    /** Defaults to the global `fetch`. Injectable so the flow is testable without a network. */
    fetch?: typeof globalThis.fetch;
};

/**
 * The browser half. Holds no credentials and never talks to storage except to PUT.
 */
export const createDirectUploader = (options: DirectUploaderOptions) => {
    const transport = options.fetch ?? globalThis.fetch;

    return {
        /**
         * Hashes, asks for a grant, uploads if needed, and returns the reference.
         *
         * Skips the transfer entirely when the server says the content is already stored.
         */
        async upload(content: FileContent, uploadOptions: UploadOptions = {}): Promise<FileReference> {
            const bytes = await toBytes(content);
            const digest = await checksum(bytes);

            const grant = await options.requestUpload({
                checksum: digest,
                size: bytes.byteLength,
                contentType: resolveContentType(content, uploadOptions),
                fileName: resolveFileName(content, uploadOptions) ?? '',
            });

            if (grant.upload == null) {
                // Already stored. Content addressing means the bytes are known to be identical.
                return grant.reference;
            }

            const response = await transport(grant.upload.url, {
                method: 'PUT',
                // Sent verbatim: the signature covers them, so an added or altered header is
                // a 403 rather than a silently different object.
                headers: grant.upload.headers,
                body: bytes as unknown as BodyInit,
            });

            if (response.ok === false) {
                throw new Error(
                    `Direct upload failed with ${response.status} ${response.statusText}. ` +
                    'The signature covers the URL and its headers, so a changed content type, ' +
                    'a changed checksum, or an expired URL all fail here.'
                );
            }

            return grant.reference;
        },
    };
};

export type DirectUploader = ReturnType<typeof createDirectUploader>;

/** Builds the reference a grant describes. Shared by the server half. */
export const referenceFor = (request: UploadRequest): FileReference => ({
    key: blobKey(request.checksum),
    size: request.size,
    contentType: request.contentType,
    checksum: request.checksum,
    fileName: request.fileName,
});
