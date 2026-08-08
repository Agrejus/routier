import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { getDialect } from './sql';
import { decodeJsonColumns, isJsonColumn, toColumnAssignments, toColumnValueMap } from './columns';

/**
 * These pin the boundary the delta refactor established: core describes a change as a
 * partial entity, and this is the only place that turns one into columns and decides a
 * nested value is JSON.
 */

const schema = s.define('col_target', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
    note: s.string().nullable(),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
    tags: s.array(s.string()),
}).compile();

const renamed = s.define('col_renamed', {
    id: s.string().key(),
    label: s.string().from('wire_label'),
}).compile();

const sqlite = getDialect('sqlite');
const postgres = getDialect('postgresql');

describe('toColumnAssignments', () => {
    it('passes a scalar through untouched', () => {
        expect(toColumnAssignments({ price: 99 }, schema as any, sqlite))
            .toEqual([{ column: 'price', value: 99 }]);
    });

    it('keeps a false boolean rather than dropping it', () => {
        // A truthiness check here would silently discard the most common boolean write. SQLite
        // has no boolean type, so `false` becomes 0 — which is still a value, not an absence.
        expect(toColumnAssignments({ active: false }, schema as any, sqlite))
            .toEqual([{ column: 'active', value: 0 }]);
    });

    it('encodes a boolean as an integer only where the engine needs it', () => {
        // `node:sqlite` refuses to bind a JS boolean rather than coercing it, so the dialect
        // converts. PostgreSQL has a real boolean type and takes one directly — converting
        // there would store an integer in a BOOLEAN column.
        expect(toColumnAssignments({ active: true }, schema as any, sqlite))
            .toEqual([{ column: 'active', value: 1 }]);
        expect(toColumnAssignments({ active: true }, schema as any, postgres))
            .toEqual([{ column: 'active', value: true }]);
        expect(toColumnAssignments({ active: false }, schema as any, postgres))
            .toEqual([{ column: 'active', value: false }]);
    });

    it('keeps a zero', () => {
        expect(toColumnAssignments({ price: 0 }, schema as any, sqlite))
            .toEqual([{ column: 'price', value: 0 }]);
    });

    it('encodes a nested object as JSON', () => {
        expect(toColumnAssignments({ nested: { inner: { value: 'y' } } }, schema as any, sqlite))
            .toEqual([{ column: 'nested', value: '{"inner":{"value":"y"}}' }]);
    });

    it('encodes an array as JSON', () => {
        expect(toColumnAssignments({ tags: ['a', 'b'] }, schema as any, sqlite))
            .toEqual([{ column: 'tags', value: '["a","b"]' }]);
    });

    it('leaves a null nested value as SQL NULL, not the string "null"', () => {
        // A JSON column holding SQL NULL is absent for IS NULL; one holding "null" is not.
        expect(toColumnAssignments({ nested: null } as any, schema as any, sqlite))
            .toEqual([{ column: 'nested', value: null }]);
    });

    it('leaves a null scalar alone', () => {
        expect(toColumnAssignments({ note: null } as any, schema as any, sqlite))
            .toEqual([{ column: 'note', value: null }]);
    });

    it('resolves a renamed property to its storage-side column', () => {
        expect(toColumnAssignments({ wire_label: 'x' }, renamed as any, sqlite))
            .toEqual([{ column: 'wire_label', value: 'x' }]);
    });

    it('also accepts a renamed property by its declared name', () => {
        expect(toColumnAssignments({ label: 'x' }, renamed as any, sqlite))
            .toEqual([{ column: 'wire_label', value: 'x' }]);
    });

    it('skips a key the schema does not know', () => {
        expect(toColumnAssignments({ ghost: 1, price: 2 }, schema as any, sqlite))
            .toEqual([{ column: 'price', value: 2 }]);
    });

    it('handles a delta touching several columns at once', () => {
        expect(toColumnAssignments({ price: 1, tags: ['t'] }, schema as any, sqlite)).toEqual([
            { column: 'price', value: 1 },
            { column: 'tags', value: '["t"]' },
        ]);
    });

    it('produces the same assignments for every dialect that stringifies', () => {
        expect(toColumnAssignments({ tags: ['a'] }, schema as any, postgres))
            .toEqual(toColumnAssignments({ tags: ['a'] }, schema as any, sqlite));
    });

    it('returns nothing for an empty delta', () => {
        expect(toColumnAssignments({}, schema as any, sqlite)).toEqual([]);
    });

    it('does NOT re-encode a value the schema already serialized to JSON', () => {
        // A schema carrying .serialize(x => JSON.stringify(x)) hands the delta a string that
        // is already JSON. Encoding by declared type would produce '"[]"' and the read side
        // would deserialize it back to the STRING "[]" rather than an array.
        expect(toColumnAssignments({ tags: '[]' } as any, schema as any, sqlite))
            .toEqual([{ column: 'tags', value: '[]' }]);
    });

    it('does not re-encode an already-serialized nested object', () => {
        expect(toColumnAssignments({ nested: '{"inner":{"value":"y"}}' } as any, schema as any, sqlite))
            .toEqual([{ column: 'nested', value: '{"inner":{"value":"y"}}' }]);
    });

    it('encodes an empty array, which is a real value and not absence', () => {
        expect(toColumnAssignments({ tags: [] }, schema as any, sqlite))
            .toEqual([{ column: 'tags', value: '[]' }]);
    });

    it('encodes an empty object', () => {
        expect(toColumnAssignments({ nested: {} } as any, schema as any, sqlite))
            .toEqual([{ column: 'nested', value: '{}' }]);
    });
});

describe('isJsonColumn', () => {
    const root = (name: string) => (schema as any).properties.filter((p: any) => p.parent == null).find((p: any) => p.name === name);

    it('is true for an object property', () => {
        expect(isJsonColumn(root('nested'))).toBe(true);
    });

    it('is true for an array property', () => {
        expect(isJsonColumn(root('tags'))).toBe(true);
    });

    it('is false for a scalar property', () => {
        expect(isJsonColumn(root('price'))).toBe(false);
    });
});

describe('dialect json settings', () => {
    it('uses JSONB on postgres, so the column is indexable', () => {
        expect(postgres.jsonColumnType).toBe('JSONB');
    });

    it('uses SQLite JSON1, which stores TEXT under a JSON type name', () => {
        expect(sqlite.jsonColumnType).toBe('JSON');
    });

    it('falls back to NVARCHAR on mssql, which has JSON functions but no JSON type', () => {
        expect(getDialect('mssql').jsonColumnType).toBe('NVARCHAR(MAX)');
    });
});

describe('toColumnValueMap', () => {
    it('keys assignments by column', () => {
        const map = toColumnValueMap({ price: 5, tags: ['a'] }, schema as any, sqlite);

        expect(map.get('price')).toBe(5);
        expect(map.get('tags')).toBe('["a"]');
    });
});

describe('decodeJsonColumns', () => {
    it('parses a JSON object column back into an object', () => {
        const rows = [{ id: 'a', nested: '{"inner":{"value":"y"}}' }];

        expect(decodeJsonColumns(rows, schema as any))
            .toEqual([{ id: 'a', nested: { inner: { value: 'y' } } }]);
    });

    it('parses a JSON array column back into an array', () => {
        expect(decodeJsonColumns([{ tags: '["a","b"]' }], schema as any))
            .toEqual([{ tags: ['a', 'b'] }]);
    });

    it('round-trips whatever toColumnAssignments produced', () => {
        const [assignment] = toColumnAssignments({ nested: { inner: { value: 'z' } } }, schema as any, sqlite);
        const rows = [{ [assignment.column]: assignment.value }];

        expect(decodeJsonColumns(rows, schema as any)).toEqual([{ nested: { inner: { value: 'z' } } }]);
    });

    it('leaves an already-parsed object alone, as pg jsonb returns', () => {
        expect(decodeJsonColumns([{ nested: { inner: { value: 'y' } } }], schema as any))
            .toEqual([{ nested: { inner: { value: 'y' } } }]);
    });

    it('leaves null alone', () => {
        expect(decodeJsonColumns([{ nested: null }], schema as any)).toEqual([{ nested: null }]);
    });

    it('leaves scalar columns alone', () => {
        expect(decodeJsonColumns([{ price: 5, name: 'x' }], schema as any))
            .toEqual([{ price: 5, name: 'x' }]);
    });

    it('does NOT touch a property whose schema deserializes it itself', () => {
        // `tags` on this schema carries .deserialize(x => JSON.parse(String(x))). Parsing it
        // here would hand that deserializer an array and JSON.parse("[object Object]") throws.
        const owned = s.define('col_owned', {
            id: s.string().key(),
            tags: s.array(s.string()).serialize(x => JSON.stringify(x)).deserialize(x => JSON.parse(String(x))),
        }).compile();

        expect(decodeJsonColumns([{ tags: '["a"]' }], owned as any)).toEqual([{ tags: '["a"]' }]);
    });

    it('leaves a non-JSON string alone rather than throwing', () => {
        expect(decodeJsonColumns([{ nested: 'not json at all' }], schema as any))
            .toEqual([{ nested: 'not json at all' }]);
    });

    it('ignores rows that are not entities, as aggregates return', () => {
        expect(decodeJsonColumns([{ count: 3 }], schema as any)).toEqual([{ count: 3 }]);
    });

    it('passes non-array input straight through', () => {
        expect(decodeJsonColumns(42, schema as any)).toBe(42);
    });
});
