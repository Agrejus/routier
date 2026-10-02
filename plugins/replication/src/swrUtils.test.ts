import { describe, expect, it } from '@jest/globals';
import { SchemaCollection } from '@routier/core/collections';
import { CompiledSchema, etags, s } from '@routier/core/schema';
import { buildUpdatePayload, etagOrder } from './swrUtils';

const numbered = s.define('swrUtilsNumbered', {
    id: s.string().key(),
    version: s.number().etag(etags.numeric),
}).compile();

const tokened = s.define('swrUtilsTokened', {
    id: s.string().key(),
    revision: s.string().etag(etags.lexical),
}).compile();

const plain = s.define('swrUtilsPlain', {
    id: s.string().key(),
    version: s.number(),
}).compile();

describe('etagOrder', () => {
    it.each([
        ['newer', { version: 1 }, { version: 2 }, -1],
        ['the same', { version: 2 }, { version: 2 }, 0],
        ['older', { version: 3 }, { version: 2 }, 1],
    ])('orders an incoming number etag that is %s', (_, stored, incoming, expected) => {
        expect(etagOrder(numbered, stored, incoming)).toBe(expected);
    });

    it('orders string etags', () => {
        expect(etagOrder(tokened, { revision: 'a' }, { revision: 'b' })).toBe(-1);
    });

    it('is null when the schema has no etag', () => {
        expect(etagOrder(plain, { version: 1 }, { version: 2 })).toBeNull();
    });

    it.each([
        ['the stored row has none', {}, { version: 2 }],
        ['the incoming row has none', { version: 1 }, {}],
        ['the stored row is null', null, { version: 2 }],
        ['the incoming row is not an object', { version: 1 }, 'row'],
        ['the stored etag is a boolean', { version: true }, { version: 2 }],
        ['the incoming etag is an object', { version: 1 }, { version: { value: 2 } }],
    ])('is null when %s', (_, stored, incoming) => {
        expect(etagOrder(numbered, stored, incoming)).toBeNull();
    });
});

const asRecords = (schema: CompiledSchema<{}>) => {
    const found = new SchemaCollection().set(schema.id, schema).get<Record<string, unknown>>(schema.id);

    if (found == null) {
        throw new Error('schema not registered');
    }

    return found;
};

describe('buildUpdatePayload', () => {
    it('sends the keys, the etag the edit was based on, and the changed fields', () => {
        expect(buildUpdatePayload(asRecords(numbered), { id: 'a', version: 3, name: 'old' }, { name: 'new' })).toStrictEqual({ id: 'a', version: 3, name: 'new' });
    });

    it('sends no etag when the row has none', () => {
        expect(buildUpdatePayload(asRecords(numbered), { id: 'a' }, { name: 'new' })).toStrictEqual({ id: 'a', name: 'new' });
    });

    it('sends no etag field for a schema without one', () => {
        expect(buildUpdatePayload(asRecords(plain), { id: 'a', version: 3 }, { name: 'new' })).toStrictEqual({ id: 'a', name: 'new' });
    });

    it.each([[{}], [null], ['name']])('sends the whole entity for the delta %p', (delta) => {
        expect(buildUpdatePayload(asRecords(numbered), { id: 'a', version: 3 }, delta)).toBeNull();
    });
});
