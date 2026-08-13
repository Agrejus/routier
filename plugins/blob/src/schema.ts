import type { FileReferenceValue } from '@routier/core/schema';

/**
 * The stored shape of a file: where the bytes are and what they are.
 *
 * Declared by `s.file()` in core, which is what a schema uses. This alias exists so the blob
 * plugin's own signatures can name the shape without importing from a subpath everywhere.
 */
export type FileReference = FileReferenceValue;
