import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInSql, toSql } from './sql';

/**
 * The SQL half of Piece 3.
 *
 * Destructured parameters, declarations, `if`/`else` and `switch` produce the trees a one-line
 * filter always produced, so what needs proving is that they still render — and that the one new
 * shape does: a call whose operand is another call, which only a parenthesised group can write.
 */

const schema = s.define('piece_three', {
    id: s.string().key(),
    name: s.string(),
    other: s.string(),
    age: s.number(),
}).compile();

const sql = (filter: any, params?: any) =>
    toSql(toExpression(schema as never, filter, params as never), 'sqlite');

const can = (filter: any, params?: any) =>
    canRenderInSql(toExpression(schema as never, filter, params as never), 'sqlite');

describe('the forms Piece 3 taught the parser to read', () => {

    it.each([
        ['a destructured entity', ({ name }: any) => name === 'ada', '"name" = ?', ['ada']],
        ['a destructured key with a call', ({ name }: any) => name.toLowerCase() === 'ada', 'LOWER("name") = ?', ['ada']],
        ['an inlined declaration', (x: any) => { const min = 3; return x.age > min; }, '"age" > ?', [3]],
        ['an inlined property', (x: any) => { const who = x.name; return who === 'ada'; }, '"name" = ?', ['ada']],
        ['if/else that is just the condition', (x: any) => { if (x.age > 3) return true; return false; }, '"age" > ?', [3]],
        ['if/else with a negated condition', (x: any) => { if (x.age > 3) return false; return true; }, '"age" <= ?', [3]],
        ['if/else with a predicate on one arm', (x: any) => { if (x.age > 3) return x.name === 'ada'; return false; }, '("age" > ? AND "name" = ?)', [3, 'ada']],
        ['a switch over one case', (x: any) => { switch (x.name) { case 'ada': return true; default: return false; } }, '"name" = ?', ['ada']],
        ['a switch with two cases', (x: any) => { switch (x.name) { case 'ada': case 'bob': return true; default: return false; } }, '("name" = ? OR "name" = ?)', ['ada', 'bob']],
    ])('renders %s', (_, filter, where, parameters) => {
        const result = sql(filter);

        expect(result.where).toBe(where);
        expect(result.params).toEqual(parameters);
    });

    it('renders both arms of a two-predicate if, with the condition negated only once', () => {
        const result = sql((x: any) => { if (x.age > 3) return x.name === 'ada'; return x.name === 'bob'; });

        expect(result.where).toBe('(("age" > ? AND "name" = ?) OR ("age" <= ? AND "name" = ?))');
        expect(result.params).toEqual([3, 'ada', 3, 'bob']);
    });

    it('renders a switch whose default carries a predicate', () => {
        const result = sql((x: any) => { switch (x.name) { case 'ada': return true; default: return x.age > 3; } });

        expect(result.where).toBe('("name" = ? OR ("name" != ? AND "age" > ?))');
        expect(result.params).toEqual(['ada', 'ada', 3]);
    });

    it('drops a params tautology out of the statement entirely', () => {
        const result = sql(([x, p]: any) => p.from === p.to && x.age > 3, { from: 1, to: 1 });

        expect(result.where).toBe('"age" > ?');
        expect(result.params).toEqual([3]);
    });
});

describe('a call whose operand is another call', () => {

    it.each([
        ['a casing method on a group', (x: any) => (x.name).toLowerCase() === 'ada', 'LOWER("name") = ?'],
        ['.length on a group', (x: any) => (x.name).length > 2, 'LENGTH("name") > ?'],
        ['a chain of two calls', (x: any) => (x.name).toLowerCase().length === 3, 'LENGTH(LOWER("name")) = ?'],
        ['.length of a concat', (x: any) => (`${x.name}${x.other}`).length > 4, 'LENGTH(("name" || "other")) > ?'],
    ])('renders %s', (_, filter, where) => {
        expect(can(filter)).toBe(true);
        expect(sql(filter).where).toBe(where);
    });
});
