import { describe, expect, it } from '@jest/globals';
import { s } from './index';

/**
 * What the generated functions do with a file property.
 *
 * This is the reason `s.file()` had to be a core primitive rather than a helper in the blob
 * plugin. `preprocess` runs before any plugin sees an entity, and it rebuilds an OBJECT
 * property field by field from the children the schema declares — `result.file = {}` followed
 * by one assignment per child. Content assigned to such a property is therefore discarded by
 * construction: it does not arrive mangled, it does not arrive at all.
 *
 * A file is a leaf, so the generated code carries the value through untouched and the bytes
 * survive as far as the plugin — the only place an upload can happen, since `preprocess` is
 * synchronous and is called from the change tracker and the broadcast path.
 */

const schema = s.define('docs', {
    id: s.string().key().identity(),
    title: s.string(),
    file: s.file(),
}).compile();

describe('a file property in generated code', () => {

    it('passes content through preprocess as the very same value', () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        const result = schema.preprocess({ title: 'x', file: bytes } as never) as { file: unknown };

        // Identity, not equality: nothing copied it, rebuilt it, or serialized it.
        expect(result.file).toBe(bytes);
    });

    it('passes a reference through unchanged too', () => {
        const reference = {
            key: 'sha256/ab/cd', size: 4, contentType: 'text/plain',
            checksum: 'cd', fileName: 'x.txt',
        };

        const result = schema.preprocess({ title: 'x', file: reference } as never) as { file: unknown };

        expect(result.file).toEqual(reference);
    });

    it('keeps a Blob whole rather than flattening it to an empty object', () => {
        // The failure mode an object property produced: a value with none of the declared
        // children became `{}`, so the content was silently gone by the time it was stored.
        const blob = new Blob(['hello'], { type: 'text/plain' });
        const result = schema.preprocess({ title: 'x', file: blob } as never) as { file: unknown };

        expect(result.file).toBe(blob);
    });

    it('does not disturb the other properties', () => {
        const result = schema.preprocess({
            title: 'kept', file: new Uint8Array([1]),
        } as never) as { title: string };

        expect(result.title).toBe('kept');
    });

    it('is a leaf, with no child properties', () => {
        // Children are exactly what makes the generated code rebuild an object field by
        // field, so a file must not have any.
        expect(schema.properties.filter(p => p.parent?.name === 'file')).toEqual([]);
        expect(schema.properties.find(p => p.name === 'file')?.type).toBe('File');
    });
});
