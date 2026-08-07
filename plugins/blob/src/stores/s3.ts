import type { BlobStore } from './types';

/**
 * S3, and everything that speaks S3.
 *
 * The client is constructed by you and handed in, which is what makes this one driver cover
 * four services. Endpoint, region and credentials are the client's business, not this file's:
 *
 * ```ts
 * import { S3Client } from '@aws-sdk/client-s3';
 * import { s3BlobStore } from '@routier/blob-plugin/stores/s3';
 *
 * // AWS
 * s3BlobStore({ bucket: 'uploads', client: new S3Client({ region: 'us-east-1' }) });
 *
 * // Cloudflare R2
 * s3BlobStore({ bucket: 'uploads', client: new S3Client({
 *     region: 'auto',
 *     endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
 *     credentials: { accessKeyId, secretAccessKey },
 * }) });
 *
 * // Google Cloud Storage, via its S3-compatible endpoint
 * s3BlobStore({ bucket: 'uploads', client: new S3Client({
 *     region: 'auto',
 *     endpoint: 'https://storage.googleapis.com',
 *     credentials: { accessKeyId, secretAccessKey },
 * }) });
 * ```
 *
 * `@aws-sdk/client-s3` is an optional peer dependency, and
 * `@aws-sdk/s3-request-presigner` is a second one needed only by `url()`. Neither is
 * downloaded by an application that does not use this store.
 *
 * Azure Blob Storage does **not** speak the S3 API and needs its own driver against the same
 * `BlobStore` interface.
 */

/** The parts of an S3 client this uses, so the type does not require the SDK to be installed. */
type S3ClientLike = {
    send(command: unknown): Promise<unknown>;
    config?: unknown;
};

export type S3BlobStoreOptions = {
    /** The bucket. It must already exist; nothing here creates one. */
    bucket: string;

    /** A configured `S3Client`. Credentials, region and endpoint come from it. */
    client: S3ClientLike;

    /**
     * Prepended to every key.
     *
     * Lets one bucket hold several applications, and lets a lifecycle rule target this
     * plugin's objects and nothing else. Keys stay content-addressed underneath it.
     */
    keyPrefix?: string;
};

/**
 * Loaded on first use rather than imported at module scope.
 *
 * The SDK is optional, and a Node application that uses the filesystem store should not fail
 * to import this package because it is absent.
 */
const loadSdk = async () => {
    try {
        return await import('@aws-sdk/client-s3');
    } catch (error) {
        throw new Error(
            '@aws-sdk/client-s3 is not installed. It is an optional peer dependency of ' +
            '@routier/blob-plugin; run `npm install @aws-sdk/client-s3`. ' +
            `Original error: ${(error as Error).message}`
        );
    }
};

/** The presigner is a second optional package, needed only for signed URLs. */
const loadPresigner = async () => {
    try {
        return await import('@aws-sdk/s3-request-presigner');
    } catch (error) {
        throw new Error(
            '@aws-sdk/s3-request-presigner is not installed. It is an optional peer ' +
            'dependency of @routier/blob-plugin, needed only for signed URLs. ' +
            `Original error: ${(error as Error).message}`
        );
    }
};

/** Reads a response body into bytes, whichever shape the runtime gave it. */
const bodyToBytes = async (body: unknown): Promise<Uint8Array> => {
    const candidate = body as {
        transformToByteArray?: () => Promise<Uint8Array>;
        arrayBuffer?: () => Promise<ArrayBuffer>;
        [Symbol.asyncIterator]?: unknown;
    };

    // The SDK's own helper, present in both the Node and browser builds.
    if (typeof candidate?.transformToByteArray === 'function') {
        return candidate.transformToByteArray();
    }

    if (typeof candidate?.arrayBuffer === 'function') {
        return new Uint8Array(await candidate.arrayBuffer());
    }

    if (candidate?.[Symbol.asyncIterator] != null) {
        const chunks: Uint8Array[] = [];
        let total = 0;

        for await (const chunk of body as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
            total += chunk.byteLength;
        }

        const joined = new Uint8Array(total);
        let offset = 0;

        for (const chunk of chunks) {
            joined.set(chunk, offset);
            offset += chunk.byteLength;
        }

        return joined;
    }

    throw new Error('Could not read the S3 response body: unrecognised stream type.');
};

/** True when the error is S3 saying the object is not there, rather than a real failure. */
const isNotFound = (error: unknown) => {
    const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };

    return candidate?.name === 'NotFound'
        || candidate?.name === 'NoSuchKey'
        || candidate?.$metadata?.httpStatusCode === 404;
};

export const s3BlobStore = (options: S3BlobStoreOptions): BlobStore => {
    const { bucket, client } = options;
    const prefix = options.keyPrefix == null || options.keyPrefix === ''
        ? ''
        : options.keyPrefix.replace(/\/+$/, '') + '/';

    /** The object key for a blob key, with the configured prefix applied. */
    const objectKey = (key: string) => `${prefix}${key}`;

    /** The blob key for an object key, with the prefix removed again. */
    const blobKeyOf = (key: string) => key.startsWith(prefix) ? key.slice(prefix.length) : key;

    return {
        name: `s3 (${bucket})`,

        async put(key, bytes, putOptions) {
            const { PutObjectCommand } = await loadSdk();

            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: objectKey(key),
                Body: bytes,
                ContentType: putOptions.contentType,
                // Content is addressed by its SHA-256 already; handing the same digest to S3
                // makes the service verify the upload rather than trusting the transfer.
                ChecksumSHA256: checksumHeader(key),
            }));
        },

        async has(key) {
            const { HeadObjectCommand } = await loadSdk();

            try {
                await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
                return true;
            } catch (error) {
                if (isNotFound(error)) {
                    return false;
                }

                // A permissions failure is not an absent object, and treating it as one would
                // silently re-upload on every call.
                throw error;
            }
        },

        async get(key) {
            const { GetObjectCommand } = await loadSdk();

            const response = await client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: objectKey(key),
            })) as { Body?: unknown };

            if (response.Body == null) {
                throw new Error(`S3 returned no body for '${key}' in ${bucket}.`);
            }

            return bodyToBytes(response.Body);
        },

        async delete(key) {
            const { DeleteObjectCommand } = await loadSdk();

            // S3 treats deleting an absent key as success, which is the semantics wanted here.
            await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
        },

        async url(key, urlOptions) {
            const presigner = await loadPresigner();
            const { GetObjectCommand } = await loadSdk();

            return presigner.getSignedUrl(
                client as never,
                new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }) as never,
                { expiresIn: urlOptions?.expiresIn ?? 300 }
            );
        },

        async uploadUrl(key, urlOptions) {
            const presigner = await loadPresigner();
            const { PutObjectCommand } = await loadSdk();

            const digest = urlOptions.checksum == null
                ? checksumHeader(key)
                : base64Digest(urlOptions.checksum);

            const headers: Record<string, string> = { 'content-type': urlOptions.contentType };

            if (digest != null) {
                headers['x-amz-checksum-sha256'] = digest;
            }

            /**
             * `signableHeaders` is not optional here, and getting this wrong is a hole rather
             * than an inefficiency.
             *
             * By default the presigner signs `host` and nothing else, even when the command
             * carries a content type and a checksum. Those then travel as ordinary headers the
             * client may omit or change at will. Verified against MinIO: dropping
             * `x-amz-checksum-sha256` from a signed PUT stored completely different bytes at a
             * content-addressed key and returned 200. The key then lies about its own content
             * — and because identical content is deduplicated, the poisoned object is served to
             * every record that references that hash.
             *
             * Naming them here puts both in `X-Amz-SignedHeaders`, so omitting or altering
             * either is a signature mismatch and the service refuses the upload.
             */
            const url = await presigner.getSignedUrl(
                client as never,
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: objectKey(key),
                    ContentType: urlOptions.contentType,
                    ChecksumSHA256: digest,
                }) as never,
                {
                    expiresIn: urlOptions.expiresIn ?? 300,
                    // Both options, and both are needed. `signableHeaders` covers
                    // `content-type`. It does NOT cover `x-amz-checksum-sha256`, because
                    // `x-amz-*` headers are HOISTED into the query string by default, and a
                    // hoisted header is not in `X-Amz-SignedHeaders` — so it stays a value the
                    // client can change. `unhoistableHeaders` keeps it in the signature.
                    //
                    // Measured, not assumed:
                    //   default              -> host
                    //   signableHeaders      -> content-type;host
                    //   unhoistableHeaders   -> host;x-amz-checksum-sha256
                    //   both                 -> content-type;host;x-amz-checksum-sha256
                    signableHeaders: new Set(Object.keys(headers)),
                    unhoistableHeaders: new Set(Object.keys(headers)),
                }
            );

            return { url, headers };
        },

        async *list(listPrefix) {
            const { ListObjectsV2Command } = await loadSdk();

            let continuationToken: string | undefined;

            // Paginated on purpose rather than collected: a bucket can hold more keys than
            // fit in memory, and a sweep only ever needs one at a time.
            do {
                const response = await client.send(new ListObjectsV2Command({
                    Bucket: bucket,
                    Prefix: objectKey(listPrefix),
                    ContinuationToken: continuationToken,
                })) as {
                    Contents?: { Key?: string }[];
                    NextContinuationToken?: string;
                    IsTruncated?: boolean;
                };

                for (const object of response.Contents ?? []) {
                    if (object.Key != null) {
                        yield blobKeyOf(object.Key);
                    }
                }

                continuationToken = response.IsTruncated === true
                    ? response.NextContinuationToken
                    : undefined;
            } while (continuationToken != null);
        },
    };
};

/**
 * The base64 SHA-256 that S3 wants, recovered from the hex in a content-addressed key.
 *
 * The digest is already in the key, so nothing is hashed twice. Returns undefined for a key
 * that is not content-addressed, which leaves the upload unverified rather than rejected —
 * a caller with their own key scheme should still be able to use this store.
 */
const checksumHeader = (key: string): string | undefined => {
    const match = /(^|\/)([0-9a-f]{64})$/.exec(key);

    if (match == null) {
        return undefined;
    }

    return base64Digest(match[2]);
};

/** Hex SHA-256 as the base64 the S3 API expects. */
const base64Digest = (hex: string): string | undefined => {
    if (/^[0-9a-f]{64}$/.test(hex) === false) {
        return undefined;
    }

    const bytes = new Uint8Array(32);

    for (let i = 0; i < 32; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }

    return btoa(String.fromCharCode(...bytes));
};
