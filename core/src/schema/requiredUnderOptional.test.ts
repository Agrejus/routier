import { describe, expect, it } from '@jest/globals';
import { s } from './builder';

const schema = s.define('things', {
    id: s.string().key(),
    info: s.object({
        inner: s.object({ n: s.number() }),
        deep: s.object({ leaf: s.object({ k: s.string() }) }),
    }).optional().nullable(),
}).compile();

const stored = (entity: object) => JSON.parse(JSON.stringify(entity));

const shapes: [string, object][] = [
    ['a missing parent', { id: 'a' }],
    ['a null parent', { id: 'b', info: null }],
    ['a present parent', { id: 'c', info: { inner: { n: 1 }, deep: { leaf: { k: 'x' } } } }],
];

describe('a required object under an optional or nullable parent', () => {
    it.each(shapes)('preprocess stores %s as it is', (_label, entity) => {
        expect(schema.preprocess(entity as never)).toEqual(stored(entity));
    });

    it.each(shapes)('serialize stores %s as it is', (_label, entity) => {
        expect(schema.serialize(entity as never)).toEqual(stored(entity));
    });

    it.each(shapes)('reads %s back as it was stored', (_label, entity) => {
        expect(schema.deserialize(schema.preprocess(entity as never) as never)).toEqual(entity);
    });

    it('fills a required object missing under a present parent', () => {
        expect(schema.serialize({ id: 'd', info: {} } as never)).toEqual({ id: 'd', info: { inner: {}, deep: { leaf: {} } } });
    });
});

describe('a required object under a parent that is only optional or only nullable', () => {
    const onlyOptional = s.define('only_optional', {
        id: s.string().key(),
        info: s.object({ inner: s.object({ n: s.number() }) }).optional(),
    }).compile();

    const onlyNullable = s.define('only_nullable', {
        id: s.string().key(),
        info: s.object({ inner: s.object({ n: s.number() }) }).nullable(),
    }).compile();

    it('stores a missing optional parent as missing', () => {
        expect(onlyOptional.serialize({ id: 'a' } as never)).toEqual({ id: 'a' });
    });

    it('stores a null nullable parent as null', () => {
        expect(onlyNullable.serialize({ id: 'b', info: null } as never)).toEqual({ id: 'b', info: null });
    });
});

describe('a required object under an optional parent inside a required object', () => {
    const nested = s.define('nested_optional', {
        id: s.string().key(),
        outer: s.object({ maybe: s.object({ inner: s.object({ n: s.number() }) }).optional() }),
    }).compile();

    it('stores a row whose required outer object is missing without throwing', () => {
        expect(nested.serialize({ id: 'a' } as never)).toEqual({ id: 'a', outer: {} });
    });

    it('fills the required object when the optional parent is present', () => {
        expect(nested.serialize({ id: 'b', outer: { maybe: {} } } as never)).toEqual({ id: 'b', outer: { maybe: { inner: {} } } });
    });
});

describe('a required object under a renamed optional parent', () => {
    const renamed = s.define('renamed_optional_parent', {
        id: s.string().key(),
        info: s.object({ inner: s.object({ n: s.number().from('n_col') }).from('inner_col') }).from('info_col').optional(),
    }).compile();

    it('writes the required object under the storage names', () => {
        expect(renamed.serialize({ id: 'a', info: { inner: { n: 1 } } } as never)).toEqual({ id: 'a', info_col: { inner_col: { n_col: 1 } } });
    });

    it('writes nothing for a missing renamed parent', () => {
        expect(renamed.serialize({ id: 'b' } as never)).toEqual({ id: 'b' });
    });
});
