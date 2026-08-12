import { describe, it, expect } from '@jest/globals';
import { Expression, toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { SqlDialectName, toSql } from './sql';

/**
 * The test that decides whether a query can be executed by a RECEIVER.
 *
 * `serialize.test.ts` in core proves a round-tripped tree gives the same runtime answers. This
 * proves the other consumer: that it emits **byte-identical SQL, with identical bound parameters,
 * on every dialect**. A transport plugin sending a whole query over the wire depends on exactly
 * that — the server has to build the statement the client would have built.
 *
 * Identical strings rather than "equivalent" ones on purpose. Any difference at all means some part
 * of the tree did not survive, and comparing rendered output catches things an object comparison
 * would wave through — a lost `negated` flag, a transformer that became `null`, a Date that arrived
 * as a string.
 */
const schema = s.define('serialized_rows', {
    id: s.string().key(),
    name: s.string(),
    rank: s.number(),
    active: s.boolean(),
    when: s.date(),
    tags: s.array(s.string()),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
    renamed: s.string().from('rn'),
}).compile();

const DIALECTS: SqlDialectName[] = ['sqlite', 'postgresql', 'mysql', 'mssql'];

const FILTERS: Array<[string, (r: any) => boolean]> = [
    ['equality', r => r.name === 'Alpha'],
    ['negated equality', r => r.name !== 'Beta'],
    ['null equality', r => r.name === null],
    ['negated null equality', r => r.name !== null],
    ['greater than', r => r.rank > 10],
    ['less than or equal', r => r.rank <= 20],
    ['boolean', r => r.active === true],
    ['starts with', r => r.name.startsWith('Al')],
    ['ends with', r => r.name.endsWith('ha')],
    ['includes on a string', r => r.name.includes('lph')],
    ['negated includes', r => !r.name.includes('zzz')],
    ['lower-cased then compared', r => r.name.toLowerCase().includes('lph')],
    ['length', r => r.name.length === 5],
    ['nested path', r => r.nested.inner.value === 'deep'],
    ['renamed property, which must render its storage column', r => r.renamed === 'here'],
    ['and', r => r.name === 'Alpha' && r.rank > 10],
    ['or', r => r.name === 'Beta' || r.rank > 10],
    ['mixed and/or', r => r.name === 'Alpha' && (r.rank > 100 || r.active === true)],
];

/** serialize → stringify → parse → rebuild, so nothing survives by holding a live reference */
const overTheWire = (filter: (r: any) => boolean) => {
    const original = toExpression(schema as never, filter as never);
    const rebuilt = Expression.fromJson(JSON.parse(JSON.stringify(Expression.toJson(original))), schema as never);

    return { original, rebuilt };
};

describe('a serialized expression builds the same SQL', () => {

    for (const dialect of DIALECTS) {
        describe(dialect, () => {
            for (const [label, filter] of FILTERS) {
                it(label, () => {
                    const { original, rebuilt } = overTheWire(filter);

                    const before = toSql(original, dialect);
                    const after = toSql(rebuilt, dialect);

                    expect(after.where).toBe(before.where);
                    expect(after.params).toEqual(before.params);

                    // Guard the test: an unparsable filter renders as a tautology on both sides and
                    // would pass while proving nothing
                    expect(before.where).not.toBe('1 = 1');
                });
            }
        });
    }

    describe('values that JSON cannot carry as they are', () => {

        it('binds a Date identically', () => {
            const original = toExpression(schema as never, ((([r, p]: [any, any]) => r.when === p.when)) as never, { when: new Date('2020-06-01T00:00:00.000Z') });
            const rebuilt = Expression.fromJson(JSON.parse(JSON.stringify(Expression.toJson(original))), schema as never);

            const before = toSql(original, 'postgresql');
            const after = toSql(rebuilt, 'postgresql');

            expect(after.where).toBe(before.where);
            expect(after.params).toEqual(before.params);
        });

        it('binds an array identically, which is what IN (...) is built from', () => {
            const original = toExpression(schema as never, ((([r, p]: [any, any]) => p.names.includes(r.name))) as never, { names: ['Alpha', 'Beta'] });
            const rebuilt = Expression.fromJson(JSON.parse(JSON.stringify(Expression.toJson(original))), schema as never);

            const before = toSql(original, 'postgresql');
            const after = toSql(rebuilt, 'postgresql');

            expect(before.where).toContain('IN');
            expect(after.where).toBe(before.where);
            expect(after.params).toEqual(before.params);
        });
    });
});
