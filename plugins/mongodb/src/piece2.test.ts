import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInMql, toMql } from './mql';

/** The Mongo half of the rest of the grammar. Predicate list shared with core and sql-core. */

const schema = s.define('piece_two', {
    id: s.string().key(),
    name: s.string().nullable(),
    other: s.string(),
    age: s.number(),
    flags: s.number(),
}).compile();

const expressionOf = (filter: (entity: any) => boolean) =>
    toExpression(schema as never, filter as never, undefined as never);

const mql = (filter: (entity: any) => boolean) => toMql(expressionOf(filter));

describe('operators MQL has', () => {

    it('renders exponent as $pow', () => {
        expect(mql((x: any) => x.age ** 2 === 100))
            .toEqual({ $expr: { $eq: [{ $pow: ['$age', { $literal: 2 }] }, { $literal: 100 }] } });
    });

    it.each([
        ['bit-and', (x: any) => (x.flags & 6) === 4, '$bitAnd', 6, 4],
        ['bit-or', (x: any) => (x.flags | 1) === 5, '$bitOr', 1, 5],
        ['bit-xor', (x: any) => (x.flags ^ 1) === 5, '$bitXor', 1, 5],
    ])('renders %s', (_, filter, operator, operand, compared) => {
        expect(mql(filter)).toEqual({
            $expr: { $eq: [{ [operator]: ['$flags', { $literal: operand }] }, { $literal: compared }] },
        });
    });

    it('renders bitwise not as $bitNot, which takes one operand', () => {
        expect(mql((x: any) => ~x.flags === -5))
            .toEqual({ $expr: { $eq: [{ $bitNot: '$flags' }, { $literal: -5 }] } });
    });

    it('renders nullish coalescing as $ifNull', () => {
        expect(mql((x: any) => (x.name ?? 'none') === 'ada'))
            .toEqual({ $expr: { $eq: [{ $ifNull: ['$name', { $literal: 'none' }] }, { $literal: 'ada' }] } });
    });

    it('renders concat as $concat', () => {
        expect(mql((x: any) => x.name === `${x.other}!`))
            .toEqual({ $expr: { $eq: ['$name', { $concat: ['$other', { $literal: '!' }] }] } });
    });

    /**
     * The condition is an aggregation EXPRESSION, not a match document. `{age: {$gt: 5}}` inside
     * `$expr` reads as `$gt` invoked with one argument, and the server rejects it.
     */
    it('renders the conditional operator as $cond, with an expression condition', () => {
        expect(mql((x: any) => (x.age > 5 ? x.other : 'small') === 'big')).toEqual({
            $expr: {
                $eq: [
                    { $cond: [{ $gt: ['$age', { $literal: 5 }] }, '$other', { $literal: 'small' }] },
                    { $literal: 'big' },
                ],
            },
        });
    });

    it('renders a pattern match as $regexMatch, carrying its flags as options', () => {
        expect(mql((x: any) => /^a/i.test(x.name)))
            .toEqual({ $expr: { $eq: [{ $regexMatch: { input: '$name', regex: '^a', options: 'i' } }, { $literal: true }] } });
    });

    it('omits options when the pattern has no flags', () => {
        expect(mql((x: any) => /^a/.test(x.name)))
            .toEqual({ $expr: { $eq: [{ $regexMatch: { input: '$name', regex: '^a' } }, { $literal: true }] } });
    });
});

describe('operators MQL does not have', () => {

    // No aggregation operator corresponds to JavaScript's shifts
    it.each([
        ['shift left', (x: any) => (x.flags << 1) === 8],
        ['shift right', (x: any) => (x.flags >> 1) === 2],
        ['unsigned shift right', (x: any) => (x.flags >>> 1) === 2],
    ])('declines %s rather than inventing one', (_, filter) => {
        expect(canRenderInMql(expressionOf(filter))).toBe(false);
    });

    it('says yes to everything it can express', () => {
        expect(canRenderInMql(expressionOf((x: any) => x.age ** 2 === 100))).toBe(true);
        expect(canRenderInMql(expressionOf((x: any) => /^a/.test(x.name)))).toBe(true);
    });

    it('does not claim a bitwise call, which needs int or long operands', () => {
        // A JS number reaches BSON as a Double when it is fractional or at least 2^31.
        expect(canRenderInMql(expressionOf((x: any) => (x.flags ^ 1) === 5))).toBe(false);
        expect(canRenderInMql(expressionOf((x: any) => (x.flags & 4) === 4))).toBe(false);
        expect(canRenderInMql(expressionOf((x: any) => ~x.flags === -6))).toBe(false);
    });

    it('does not claim a regex whose flags change what matches', () => {
        expect(canRenderInMql(expressionOf((x: any) => /^a/y.test(x.name)))).toBe(false);
        expect(canRenderInMql(expressionOf((x: any) => /^a/u.test(x.name)))).toBe(false);
    });

    it('claims a regex whose flags it can drop or render', () => {
        expect(canRenderInMql(expressionOf((x: any) => /^a/g.test(x.name)))).toBe(true);
        expect(canRenderInMql(expressionOf((x: any) => /^a/i.test(x.name)))).toBe(true);
    });
});
