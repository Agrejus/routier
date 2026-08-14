import type { IDbPlugin } from '@routier/core/plugins';
import { BlobDbPlugin } from './BlobDbPlugin';
import { createDirectUploader, type DirectUploader, type DirectUploaderOptions } from './direct';

/** Configuration for automatic presigned uploads in front of an HTTP database plugin. */
export type DirectUploadPluginOptions = DirectUploaderOptions;

/**
 * Uploads staged `s.file()` content through short-lived signed URLs before an inner plugin saves.
 *
 * This is the browser-safe counterpart to `S3Plugin`. It holds no S3 credentials. The
 * `requestUpload` callback asks trusted server code for a grant, the browser sends the bytes
 * directly to object storage, and the inner plugin receives only a JSON-safe `FileReference`.
 * That makes it compose naturally with `HttpTransportDbPlugin`, `HttpSwrDbPlugin`, or another
 * HTTP-backed Routier plugin.
 *
 * ```ts
 * const plugin = new DirectUploadPlugin(
 *     new HttpTransportDbPlugin({ url: '/api/routier' }),
 *     {
 *         requestUpload: request => fetch('/api/uploads/sign', {
 *             method: 'POST',
 *             headers: { 'content-type': 'application/json' },
 *             body: JSON.stringify(request),
 *         }).then(response => response.json()),
 *     }
 * );
 *
 * await store.documents.addAsync({ title: 'Report', file });
 * await store.saveChangesAsync(); // signs, uploads, then sends the row over HTTP
 * ```
 */
export class DirectUploadPlugin extends BlobDbPlugin<DirectUploader> {
    constructor(plugin: IDbPlugin, options: DirectUploadPluginOptions) {
        super(plugin, createDirectUploader(options));
    }
}
