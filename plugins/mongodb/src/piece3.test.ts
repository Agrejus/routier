import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInMql, toMql } from './mql';

/**
 * The Mongo half of Piece 3.
 *
 * The rewritten forms produce the trees a one-line filter always produced, so what needs proving is
 * that they still render — and that a call whose operand is another call does too.
 */

const schema = s.define('piece_three', {
    id: s.string().key(),
    name: s.string(),
    other: s.string(),
    age: s.number(),
}).compile();

const mql = (filter: any, params?: any) => toMql(toExpression(schema as never, filter, params as never));

const can = (filter: any, params?: any) => canRenderInMql(toExpression(schema as never, filter, params as never));

describe('the forms Piece 3 taught the parser to read', () => {

    it('renders a destructured entity key', () => {
        expect(mql(({ name }: any) => name === 'ada')).toEqual({ name: { $eq: 'ada' } });
    });

    it('renders an inlined declaration', () => {
        expect(mql((x: any) => { const min = 3; return x.age > min; })).toEqual({ age: { $gt: 3 } });
    });

    it('renders an if/else that is just its condition', () => {
        expect(mql((x: any) => { if (x.age > 3) return true; return false; })).toEqual({ age: { $gt: 3 } });
    });

    it('renders an if/else whose condition is negated', () => {
        expect(mql((x: any) => { if (x.age > 3) return false; return true; })).toEqual({ age: { $lte: 3 } });
    });

    it('renders both arms of a two-predicate if', () => {
        expect(mql((x: any) => { if (x.age > 3) return x.name === 'ada'; return x.name === 'bob'; })).toEqual({
            $or: [
                { $and: [{ age: { $gt: 3 } }, { name: { $eq: 'ada' } }] },
                { $and: [{ age: { $lte: 3 } }, { name: { $eq: 'bob' } }] }
            ]
        });
    });

    it('renders a switch as the disjunction of its cases', () => {
        expect(mql((x: any) => { switch (x.name) { case 'ada': case 'bob': return true; default: return false; } }))
            .toEqual({ $or: [{ name: { $eq: 'ada' } }, { name: { $eq: 'bob' } }] });
    });

    it('renders a switch whose default carries a predicate', () => {
        expect(mql((x: any) => { switch (x.name) { case 'ada': return true; default: return x.age > 3; } })).toEqual({
            $or: [{ name: { $eq: 'ada' } }, { $and: [{ name: { $ne: 'ada' } }, { age: { $gt: 3 } }] }]
        });
    });

    it('drops a params tautology out of the query entirely', () => {
        expect(mql(([x, p]: any) => p.from === p.to && x.age > 3, { from: 1, to: 1 })).toEqual({ age: { $gt: 3 } });
    });
});

describe('a call whose operand is another call', () => {

    it.each([
        ['a casing method on a group', (x: any) => (x.name).toLowerCase() === 'ada'],
        ['.length on a group', (x: any) => (x.name).length > 2],
        ['a chain of two calls', (x: any) => (x.name).toLowerCase().length === 3],
        ['.length of a concat', (x: any) => (`${x.name}${x.other}`).length > 4],
    ])('claims and renders %s', (_, filter) => {
        expect(can(filter)).toBe(true);
        expect(mql(filter)).toBeTruthy();
    });

    it('nests the operand call inside the outer one', () => {
        expect(mql((x: any) => (x.name).toLowerCase().length === 3)).toEqual({
            $expr: { $eq: [{ $strLenCP: { $toLower: '$name' } }, { $literal: 3 }] }
        });
    });
});
