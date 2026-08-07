import { SchemaTypes } from '@routier/core/schema';
import type { PropertyInfo } from '@routier/core/schema';

/**
 * Turning a value into text so it can be encrypted, and back again.
 *
 * A ciphertext is text. Everything else about a property survives encryption, but its storage
 * type cannot: an encrypted number has to live in a column that holds a string.
 *
 * What arrives here is not always what the schema declares. The generated `preprocess` runs
 * before any plugin, and it has already serialised some types by then — measured, rather than
 * assumed:
 *
 * | Declared | What the wrapper receives |
 * | --- | --- |
 * | `s.number()` | `number` |
 * | `s.boolean()` | `boolean` |
 * | `s.date()` | `string`, already ISO |
 * | `s.string()` | `string` |
 * | `s.object()` / `s.array()` | the object |
 *
 * So the job is symmetry, not conversion to some canonical form: whatever shape the wrapper
 * was handed on the way down is the shape it must hand back on the way up, or the layers above
 * receive something they will not deserialise correctly.
 */

/** The runtime shape a property's value has when a plugin sees it. */
type WireShape = 'number' | 'boolean' | 'string' | 'json';

const wireShapeOf = (property: PropertyInfo<any>): WireShape => {
    switch (property.type) {
        case SchemaTypes.Number:
            return 'number';
        case SchemaTypes.Boolean:
            return 'boolean';
        case SchemaTypes.Object:
        case SchemaTypes.Array:
            return 'json';
        default:
            // String and Date both arrive as strings; a Date has already been through
            // `preprocess` and is ISO text by now.
            return 'string';
    }
};

/** The text to encrypt for one value. */
export const toText = (value: unknown, property: PropertyInfo<any>): string => {
    switch (wireShapeOf(property)) {
        case 'number':
        case 'boolean':
            return String(value);
        case 'json':
            return JSON.stringify(value);
        default:
            return value as string;
    }
};

/**
 * The value to hand back once the text is decrypted.
 *
 * Restores the shape the wrapper was given, not the shape the application declared. A date
 * comes back as its ISO string because that is what arrived, and the layers above turn it
 * into a `Date` exactly as they would for an unencrypted column.
 */
export const fromText = (text: string, property: PropertyInfo<any>): unknown => {
    switch (wireShapeOf(property)) {
        case 'number':
            return Number(text);
        case 'boolean':
            return text === 'true';
        case 'json':
            return JSON.parse(text);
        default:
            return text;
    }
};

/** Whether a value can be encrypted at all, so a bad one is reported rather than mangled. */
export const isEncryptable = (value: unknown, property: PropertyInfo<any>): boolean => {
    switch (wireShapeOf(property)) {
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'json':
            return typeof value === 'object';
        default:
            return typeof value === 'string';
    }
};
