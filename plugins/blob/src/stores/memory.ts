import type { BlobStore } from './types';

/**
 * A blob store in a Map.
 *
 * For tests and for demos. It is the store the plugin's own suite runs against, which is what
 * lets every behaviour here — content addressing, dedup, idempotent upload, orphan sweeping —
 * be tested with no cloud account and no container.
 */
export const memoryBlobStore = (): BlobStore => {
    const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();

    return {
        name: 'memory',

        async put(key, bytes, options) {
            // Copied on the way in. A caller who reuses a buffer after uploading would
            // otherwise mutate stored content, which no real store would let them do.
            const stored = new Uint8Array(bytes.byteLength);
            stored.set(bytes);

            objects.set(key, { bytes: stored, contentType: options.contentType });
        },

        async has(key) {
            return objects.has(key);
        },

        async get(key) {
            const found = objects.get(key);

            if (found == null) {
                throw new Error(`No object at '${key}' in the memory blob store.`);
            }

            const copy = new Uint8Array(found.bytes.byteLength);
            copy.set(found.bytes);

            return copy;
        },

        async delete(key) {
            objects.delete(key);
        },

        async *list(prefix) {
            // A snapshot, deliberately. `sweepOrphans` deletes as it consumes this generator,
            // and deleting from a Map that is mid-iteration is how a sweep silently skips
            // half the keys it was asked to consider.
            const keys = Array.from(objects.keys());

            for (const key of keys) {
                if (key.startsWith(prefix)) {
                    yield key;
                }
            }
        },
    };
};
