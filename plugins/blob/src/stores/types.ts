/**
 * The whole of what this plugin needs from a blob store.
 *
 * Five operations, none of them a query. That is the point: a blob store is asked for one
 * object by key and nothing else. Everything you would want to filter, sort or count on —
 * size, content type, owner, upload date — is a column in your database, so S3 is never asked
 * a question it answers badly.
 *
 * Implementations ship for the local filesystem and for memory. S3, R2, GCS and Azure are the
 * same interface; R2 and GCS both speak the S3 API, so one driver covers three of them.
 */

/** What a stored object looks like once it is in the store. */
export type BlobDescriptor = {
    /** Where the bytes live. Content-addressed: `sha256/<checksum>`. */
    key: string;
    /** Byte length, so a caller can decide whether to download before downloading. */
    size: number;
    /** Media type, as given at upload. Never sniffed. */
    contentType: string;
    /** SHA-256 of the bytes, lowercase hex. Also the address — see `blobKey`. */
    checksum: string;
};

export interface BlobStore {
    /** Names the store, so an error says which one failed. */
    readonly name: string;

    /**
     * Writes bytes at `key`.
     *
     * Must be idempotent: keys are content-addressed, so writing the same key twice writes
     * identical bytes, and a retried upload has to be harmless rather than a duplicate.
     */
    put(key: string, bytes: Uint8Array, options: { contentType: string }): Promise<void>;

    /** Whether `key` already holds bytes. Lets an upload skip work it has already done. */
    has(key: string): Promise<boolean>;

    /** Reads the bytes back. Rejects when the key is absent. */
    get(key: string): Promise<Uint8Array>;

    /** Removes the object. Succeeds when it is already gone. */
    delete(key: string): Promise<void>;

    /**
     * A URL a browser can fetch directly, if the store can issue one.
     *
     * Optional because not every store can. The filesystem store cannot, and says so rather
     * than pretending. For S3 and its compatibles this is a presigned GET, which is what lets
     * a browser download bytes without proxying them through your server.
     */
    url?(key: string, options?: { expiresIn?: number }): Promise<string>;

    /**
     * Every key under `prefix`.
     *
     * Only for sweeping orphans, which is the one job that legitimately needs to enumerate a
     * bucket. Never call it on a read path.
     */
    list?(prefix: string): AsyncIterable<string>;

    /**
     * A URL a client can PUT bytes to directly, if the store can issue one.
     *
     * This is what lets a browser upload to S3 without the bytes passing through your server:
     * the server signs, the browser transfers. A ten-gigabyte upload costs your API one small
     * JSON response.
     *
     * Returns the headers the client MUST send with the PUT. A presigned URL signs the
     * headers as well as the path, so a client that omits or changes one gets a 403 — that is
     * the mechanism that stops a signed URL for a small text file being reused to upload
     * something else.
     */
    uploadUrl?(key: string, options: UploadUrlOptions): Promise<PresignedUpload>;
}

export type UploadUrlOptions = {
    /** Media type the client will send. Signed, so the client must send exactly this. */
    contentType: string;

    /** Seconds the URL stays valid. Keep it short; it is a bearer token for one object. */
    expiresIn?: number;

    /**
     * SHA-256 of the content, lowercase hex, when the key is content-addressed.
     *
     * Handed to the service so it verifies the body against the digest. Without it a client
     * can claim one checksum and upload different bytes, and the key — which promises to be
     * the hash of what it holds — would be a lie that nothing detects.
     */
    checksum?: string;
};

export type PresignedUpload = {
    /** Where to PUT the bytes. */
    url: string;

    /** Headers the client must send verbatim, or the signature will not match. */
    headers: Record<string, string>;
};
