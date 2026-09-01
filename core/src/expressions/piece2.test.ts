import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { evaluate } from './evaluate';
import { toExpression } from './parser';

/**
 * The rest of the grammar: exponent, bitwise, shifts, the conditional operator, nullish coalescing,
 * regex literals, template interpolation and bigint.
 *
 * The tree carried all of it already — these are names in the `Call` union and characters the parser
 * had to learn to read. The predicate list is shared with the SQL and Mongo halves.
 */

const schema = s.define('piece_two', {
    id: s.string().key(),
    name: s.string().nullable(),
    other: s.string(),
    age: s.number(),
    flags: s.number(),
}).compile();

const answers = (filter: (entity: any) => boolean, row: {}): boolean | undefined =>
    evaluate(toExpression(schema as never, filter as never, undefined as never), row as never);

const answersWith = (filter: (payload: [any, any]) => boolean, params: {}, row: {}): boolean | undefined =>
    evaluate(toExpression(schema as never, filter as never, params as never), row as never);

describe('exponent', () => {

    it('raises to a power', () => {
        expect(answers((x: any) => x.age ** 2 === 100, { age: 10 })).toBe(true);
        expect(answers((x: any) => x.age ** 2 === 100, { age: 9 })).toBe(false);
    });

    // 2 ** 3 ** 2 is 2 ** 9, not 8 ** 2 — the one right-associative operator here
    it('is right-associative', () => {
        expect(answers((x: any) => x.age ** 3 ** 2 === 1, { age: 1 })).toBe(true);
        expect(answers((x: any) => 2 ** 3 ** 2 === x.age, { age: 512 })).toBe(true);
        expect(answers((x: any) => 2 ** 3 ** 2 === x.age, { age: 64 })).toBe(false);
    });

    it('binds tighter than multiplication', () => {
        // 2 * 3 ** 2 is 18, not 36
        expect(answers((x: any) => x.age === 2 * 3 ** 2, { age: 18 })).toBe(true);
    });
});

describe('bitwise', () => {

    it.each([
        ['and', (x: any) => (x.flags & 6) === 2, { flags: 5 }, false],
        ['and, matching', (x: any) => (x.flags & 6) === 4, { flags: 4 }, true],
        ['or', (x: any) => (x.flags | 1) === 5, { flags: 4 }, true],
        ['xor', (x: any) => (x.flags ^ 1) === 5, { flags: 4 }, true],
        ['shift left', (x: any) => (x.flags << 2) === 16, { flags: 4 }, true],
        ['shift right', (x: any) => (x.flags >> 1) === 2, { flags: 4 }, true],
        ['unsigned shift right', (x: any) => (x.flags >>> 1) === 2, { flags: 4 }, true],
        ['not', (x: any) => ~x.flags === -5, { flags: 4 }, true],
    ])('answers %s', (_, filter, row, expected) => {
        expect(answers(filter, row)).toBe(expected);
    });

    /**
     * `&` binds tighter than `|`, and both bind LOOSER than the shifts. Written without brackets so
     * a wrong precedence gives a different number rather than a parse error.
     */
    it('orders the bitwise levels the way JavaScript does', () => {
        expect(answers((x: any) => (x.flags | 1 & 0) === 4, { flags: 4 })).toBe(true);
        expect(answers((x: any) => (1 | 2 ^ 3) === x.flags, { flags: 1 })).toBe(true);
        expect(answers((x: any) => (x.flags & 1 << 2) === 4, { flags: 4 })).toBe(true);
    });
});

describe('nullish coalescing', () => {

    it('takes the fallback when the property is null', () => {
        expect(answers((x: any) => (x.name ?? 'none') === 'none', { name: null })).toBe(true);
    });

    it('takes the property when it is present', () => {
        expect(answers((x: any) => (x.name ?? 'none') === 'ada', { name: 'ada' })).toBe(true);
    });

    // `??` answers about absence, so it must not inherit the rule that an absent operand has no answer
    it('takes the fallback when the property is missing entirely', () => {
        expect(answers((x: any) => (x.name ?? 'none') === 'none', {})).toBe(true);
    });

    // Unlike `||`, an empty string is a value, not a reason to fall back
    it('does not fall back for an empty string', () => {
        expect(answers((x: any) => (x.name ?? 'none') === '', { name: '' })).toBe(true);
    });
});

describe('the conditional operator', () => {

    it('picks the branch the condition selects', () => {
        expect(answers((x: any) => (x.age > 5 ? x.other : 'small') === 'big', { age: 9, other: 'big' })).toBe(true);
        expect(answers((x: any) => (x.age > 5 ? x.other : 'small') === 'small', { age: 1, other: 'big' })).toBe(true);
    });

    it('has no answer when the condition cannot be evaluated', () => {
        expect(answers((x: any) => (x.age > 5 ? x.other : 'small') === 'big', {})).toBeUndefined();
    });
});

describe('regex literals', () => {

    it('tests a property against a pattern', () => {
        expect(answers((x: any) => /^a/.test(x.name), { name: 'ada' })).toBe(true);
        expect(answers((x: any) => /^a/.test(x.name), { name: 'bob' })).toBe(false);
    });

    it('honours flags', () => {
        expect(answers((x: any) => /^A/i.test(x.name), { name: 'ada' })).toBe(true);
        expect(answers((x: any) => /^A/.test(x.name), { name: 'ada' })).toBe(false);
    });

    // The character that has to be told apart from division
    it('does not confuse a pattern with a divide', () => {
        expect(answers((x: any) => x.age / 2 === 5, { age: 10 })).toBe(true);
        expect(answers((x: any) => /2/.test(x.other), { other: 'a2b' })).toBe(true);
    });
});

describe('template literals', () => {

    it('interpolates a param', () => {
        expect(answersWith(([x, p]: any) => x.name === `${p.prefix}-ada`, { prefix: 'ms' }, { name: 'ms-ada' })).toBe(true);
    });

    it('interpolates a property', () => {
        expect(answers((x: any) => x.name === `${x.other}!`, { name: 'ada!', other: 'ada' })).toBe(true);
    });
});

describe('bigint', () => {

    /** Past 2^53 a number literal loses the value; `JSON.stringify` throws on a bigint outright. */
    it('reads a bigint literal rather than choking on the suffix', () => {
        const parsed = toExpression(schema as never, ((x: any) => x.age === 9007199254740993n) as never, undefined as never) as { type: string };

        expect(parsed.type).toBe('comparator');
    });
});

/**
 * Four ways this grammar could disagree with JavaScript about the same source.
 *
 * Every one produced a tree that answered differently from the caller's own function, with no error —
 * which is the only failure here worth ranking above everything else.
 */
describe('agreeing with JavaScript, or refusing', () => {

    const bothWays = (source: string, row: {}) => {
        const parsed = toExpression(schema as never, { toString: () => source } as never) as never;
        const written = new Function('x', `return (${source})(x);`) as (row: {}) => unknown;

        return { tree: evaluate(parsed, row as never), js: written(row) };
    };

    // `${x.age > 5 ? 'a' : 'b'}` used to parse as just `x.age`, dropping the rest in silence
    it('does not read part of an interpolation and keep going', () => {
        const { tree, js } = bothWays("(x) => x.name === `${x.age > 5 ? 'big' : 'small'}`", { age: 9, name: 'big' });

        expect(js).toBe(true);
        expect(tree === true || tree === undefined).toBe(true);
    });

    it('stringifies a lone interpolation, which has no concat to coerce it', () => {
        const { tree, js } = bothWays('(x) => x.name === `${x.age}`', { name: '9', age: 9 });

        expect(js).toBe(true);
        expect(tree).toBe(true);
    });

    /**
     * `x.flags & 6 === 2` is `x.flags & (6 === 2)` in JavaScript — 0, always falsy. Read as
     * `(x.flags & 6) === 2` it is true for `flags: 2`. Refused, so the caller's function decides.
     */
    it('refuses a bitwise comparison without brackets rather than reading it the other way', () => {
        const parsed = toExpression(schema as never, { toString: () => '(x) => x.flags & 6 === 2' } as never) as { type: string };

        expect(parsed.type).toBe('not-parsable');
    });

    it('refuses an unbracketed nullish mix, which JavaScript groups the other way', () => {
        const parsed = toExpression(schema as never, { toString: () => "(x) => x.name === x.other ?? 'zzz'" } as never) as { type: string };

        expect(parsed.type).toBe('not-parsable');
    });

    it('still reads the bracketed forms, which say which was meant', () => {
        expect(answers((x: any) => (x.flags & 6) === 2, { flags: 2 })).toBe(true);
        expect(answers((x: any) => (x.name ?? 'zzz') === 'zzz', { name: null })).toBe(true);
    });
});
