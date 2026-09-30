import { describe, expect, it } from '@jest/globals';
import { compiledSchemaToJsonSchema, rehydrateSchemaFromJsonSchema, s } from '@routier/core/schema';
import { pouchRevision } from './pouchRevision';

describe('pouchRevision', () => {
    it.each([
        ['an older generation', '1-abc', '2-abc', -1],
        ['a newer generation', '2-abc', '1-abc', 1],
        ['a generation with more digits', '9-fff', '10-000', -1],
        ['the same generation with a smaller hash', '3-aaa', '3-bbb', -1],
        ['the same generation with a larger hash', '3-bbb', '3-aaa', 1],
        ['the same revision', '3-abc', '3-abc', 0],
    ])('orders %s', (_, prev, next, expected) => {
        expect(pouchRevision(prev, next)).toBe(expected);
    });

    it('sorts revisions oldest first', () => {
        expect(['10-a', '2-b', '2-a', '1-z'].sort(pouchRevision)).toEqual(['1-z', '2-a', '2-b', '10-a']);
    });

    it('compares the same pairs after a JSON Schema round trip', () => {
        const schema = s.define('pouch_revision_round_trip', {
            _id: s.string().key(),
            _rev: s.string().etag(pouchRevision),
        }).compile();
        const rebuilt = rehydrateSchemaFromJsonSchema(compiledSchemaToJsonSchema(schema, 'draft-2020-12', false)).compile();
        const pairs: [string, string][] = [['9-fff', '10-000'], ['3-bbb', '3-aaa'], ['3-abc', '3-abc']];

        expect(pairs.map(([prev, next]) => rebuilt.etagProperty?.etagComparator?.(prev, next))).toEqual([-1, 1, 0]);
    });
});
