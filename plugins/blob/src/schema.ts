import { s } from '@routier/core/schema';

/**
 * Marks a property as holding a file reference.
 *
 * `PropertyInfo.tags` is carried through compilation, so a plugin or a sweeper can find every
 * file-bearing property of a schema without being told where they are.
 */
export const FILE_TAG = 'routier:file';


/**
 * The property a file reference lives in.
 *
 * ```ts
 * const documentSchema = s.define('documents', {
 *     id: s.string().key().identity(),
 *     ownerId: s.string().index(),
 *     title: s.string(),
 *     file: fileRef(),
 * }).compile();
 * ```
 *
 * What is stored is the reference, never the bytes: a key, a size, a content type, a checksum
 * and the original name. A query over ten thousand documents reads five short strings per row
 * and touches blob storage zero times.
 *
 * ## Why this is not `s.file()` yet
 *
 * The ergonomic version — assigning a `File` straight to the property and letting a wrapper
 * plugin upload it during `saveChangesAsync` — cannot work today, and it is worth writing down
 * why so nobody re-derives it.
 *
 * A schema's generated `preprocess`/`serialize` runs **before** any plugin sees an entity, and
 * it keeps only what the schema declares. Assigning a `Uint8Array` to a property declared as
 * an object does not reach the plugin mangled; the property arrives `undefined`, and the
 * generated code throws reading a child off it. Content cannot ride inside a declared property
 * without core support, so `s.file()` would have to be a real schema primitive with its own
 * serialize and deserialize.
 *
 * Until then the upload is explicit and returns the reference you store, which is one extra
 * line and has a compensation: it makes visible that two systems are being written to. That
 * was never going to be one atomic act — blob stores have no transactions to enlist in — and a
 * hidden upload would have implied otherwise.
 */
export const fileRef = () =>
    s.object({
        /** Where the bytes live, content-addressed. */
        key: s.string(),
        /** Byte length, so a caller can decide before downloading. */
        size: s.number(),
        /** Media type as supplied at upload. */
        contentType: s.string(),
        /** SHA-256 of the bytes, lowercase hex. */
        checksum: s.string(),
        /** The name to show a user. Not part of the key. */
        fileName: s.string(),
    }).tag(FILE_TAG);

/** The stored shape. What `upload` returns and what a query gives back. */
export type FileReference = {
    key: string;
    size: number;
    contentType: string;
    checksum: string;
    fileName: string;
};
