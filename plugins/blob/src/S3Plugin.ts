import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import type { IDbPlugin } from '@routier/core/plugins';
import { BlobDbPlugin } from './BlobDbPlugin';
import { createFiles } from './files';
import { s3BlobStore, type S3ClientLike } from './stores/s3';

type SharedOptions = {
    /** An existing bucket. Routier never creates or changes the bucket itself. */
    bucket: string;

    /** Optional namespace for keeping applications or environments in one bucket. */
    keyPrefix?: string;
};

/**
 * Configuration for the high-level S3 file plugin.
 *
 * The normal form is the AWS SDK configuration plus `bucket` and optional `keyPrefix`. Routier
 * constructs the client. Supplying `client` is an escape hatch for applications that already
 * manage a client or need custom instrumentation.
 */
export type S3PluginOptions = SharedOptions & (
    | ({ client: S3ClientLike } & Partial<S3ClientConfig>)
    | ({ client?: never } & S3ClientConfig)
);

/**
 * Adds automatic S3 file persistence to any Routier database plugin.
 *
 * This is the simple API. Assign a `File`, `Blob`, `Uint8Array`, or string to an `s.file()`
 * property and call `saveChangesAsync()`. The save uploads the bytes first and gives the inner
 * database plugin only the resulting file reference.
 *
 * ```ts
 * const plugin = new S3Plugin(new DexiePlugin('app'), {
 *     bucket: 'my-app-files',
 *     region: 'us-east-1',
 * });
 *
 * const store = new AppStore(plugin);
 * await store.documents.addAsync({ title: 'Report', file });
 * await store.saveChangesAsync(); // uploads to S3, then saves the row
 * ```
 *
 * S3 is the byte store rather than the row database, so an inner database plugin is still
 * required. Keeping those roles separate lets the same S3 plugin compose with Dexie, SQLite,
 * PostgreSQL, replication, or any future Routier database plugin.
 */
export class S3Plugin extends BlobDbPlugin {
    constructor(plugin: IDbPlugin, options: S3PluginOptions) {
        const { bucket, keyPrefix, client, ...clientConfig } = options;
        const resolvedClient = client ?? new S3Client(clientConfig as S3ClientConfig);
        const files = createFiles(s3BlobStore({ bucket, keyPrefix, client: resolvedClient }));

        super(plugin, files);
    }
}
