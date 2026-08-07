/**
 * Turning whatever a caller has into bytes and an address.
 *
 * The same code runs in Node and in a browser. `crypto.subtle` is standard in both (Node 18
 * and later expose it on `globalThis`), so there is one hashing implementation rather than a
 * Node branch and a web branch that can disagree about what a checksum is.
 */

/** Anything a caller can hand to `upload`. */
export type FileContent =
    | Uint8Array
    | ArrayBuffer
    | Blob
    | string;

export type UploadOptions = {
    /**
     * Media type. Taken from a `Blob`/`File` when it has one.
     *
     * Never sniffed from the bytes. A wrong content type served back to a browser is a
     * security question, not a convenience one, so it is the caller's to state.
     */
    contentType?: string;

    /** The name to show a user. Stored as metadata; it is not part of the key. */
    fileName?: string;
};

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

const textEncoder = new TextEncoder();

/** Reads any supported content into bytes. */
export const toBytes = async (content: FileContent): Promise<Uint8Array> => {
    if (content instanceof Uint8Array) {
        return content;
    }

    if (content instanceof ArrayBuffer) {
        return new Uint8Array(content);
    }

    if (typeof content === 'string') {
        return textEncoder.encode(content);
    }

    if (typeof Blob !== 'undefined' && content instanceof Blob) {
        return new Uint8Array(await content.arrayBuffer());
    }

    throw new TypeError(
        'Unsupported file content. Pass a Uint8Array, ArrayBuffer, Blob, File, or string.'
    );
};

/** The content type a caller stated, or the one the Blob carries, or the generic fallback. */
export const resolveContentType = (content: FileContent, options: UploadOptions): string => {
    if (options.contentType != null && options.contentType !== '') {
        return options.contentType;
    }

    if (typeof Blob !== 'undefined' && content instanceof Blob && content.type !== '') {
        return content.type;
    }

    return DEFAULT_CONTENT_TYPE;
};

/** The display name a caller stated, or the one a `File` carries. */
export const resolveFileName = (content: FileContent, options: UploadOptions): string | undefined => {
    if (options.fileName != null) {
        return options.fileName;
    }

    const named = content as { name?: unknown };

    return typeof named?.name === 'string' ? named.name : undefined;
};

/** SHA-256 as lowercase hex. */
export const checksum = async (bytes: Uint8Array): Promise<string> => {
    // A copy of exactly this view's range. `bytes.buffer` can be a window into a larger
    // allocation, so hashing the buffer would hash the parent — a subarray and its parent
    // would share a checksum, and therefore a key, and therefore each other's content.
    // The copy also sidesteps SharedArrayBuffer, which `digest` will not accept.
    const view = new Uint8Array(bytes.byteLength);
    view.set(bytes);

    const digest = await crypto.subtle.digest('SHA-256', view);

    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * The key for a given checksum.
 *
 * Content-addressed, and that decision earns three things. An upload is idempotent, so a retry
 * cannot create a second object. Identical bytes uploaded from anywhere land on one object, so
 * a file attached to a thousand records is stored once. And a key cannot be wrong about what
 * it holds, because the key *is* what it holds.
 *
 * It also has one consequence that must not be forgotten: **two records can reference the same
 * key**, so deleting a record must never delete its object. See `sweepOrphans`.
 */
export const blobKey = (digest: string) => `sha256/${digest.slice(0, 2)}/${digest}`;
