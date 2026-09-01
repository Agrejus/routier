import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { evaluate } from './evaluate';
import { toExpression } from './parser';
import { Expression } from './types';

/**
 * Ordinary JavaScript the parser used to refuse: destructured parameters, declarations, `if`/`else`
 * and `switch`.
 *
 * These produce the same trees the equivalent one-line filter always produced, so the only claim
 * under test is that the parser reads them and reads them as JavaScript does. Every case asserts the
 * tree's answer against the answer the closure itself gives for the same row.
 */

const schema = s.define('piece3', {
    id: s.string().key(),
    age: s.number(),
    name: s.string(),
    other: s.string(),
}).compile();

type Row = { id?: string, age?: number, name?: string, other?: string };

const treeFor = (filter: any, params?: any) => toExpression(schema as never, filter, params as never);

const answers = (filter: any, row: Row, params?: any): boolean | undefined =>
    evaluate(treeFor(filter, params) as never, row as never);

/**
 * Whether JavaScript itself keeps the row, so no expectation is hand-computed.
 *
 * Truthiness rather than the raw value: a `switch` that falls out of every case returns `undefined`,
 * and a filter keeps a row only when its answer is true.
 */
const inJs = (filter: any, row: Row, params?: any): boolean =>
    Boolean(filter(params === undefined ? row : [row, params]));

const agrees = (filter: any, row: Row, params?: any) => {
    expect(Expression.isNotParsable(treeFor(filter, params))).toBe(false);
    expect(answers(filter, row, params)).toBe(inJs(filter, row, params));
};

describe('destructured parameters', () => {

    it.each([
        ['the entity', ({ name }: any) => name === 'ada', { name: 'ada' }],
        ['the entity, not matching', ({ name }: any) => name === 'ada', { name: 'bob' }],
        ['a renamed key', ({ name: who }: any) => who === 'ada', { name: 'ada' }],
        ['two keys', ({ name, age }: any) => name === 'ada' && age > 3, { name: 'ada', age: 4 }],
        ['a key with a call on it', ({ name }: any) => name.toLowerCase() === 'ada', { name: 'ADA' }],
        ['a key with a comparator method', ({ name }: any) => name.startsWith('a'), { name: 'ada' }],
        ['a key with .length', ({ name }: any) => name.length > 2, { name: 'ada' }],
    ])('reads %s', (_, filter, row) => {
        agrees(filter, row);
    });

    it.each([
        ['the entity of the pair', ([{ name }, p]: any) => name === p.who, { name: 'ada' }, { who: 'ada' }],
        ['the params of the pair', ([x, { who }]: any) => x.name === who, { name: 'ada' }, { who: 'ada' }],
        ['both sides of the pair', ([{ name }, { who }]: any) => name === who, { name: 'ada' }, { who: 'ada' }],
        ['a renamed param key', ([x, { who: w }]: any) => x.name === w, { name: 'ada' }, { who: 'ada' }],
        ['a nested param path', ([x, { range }]: any) => x.age > range.min, { age: 4 }, { range: { min: 3 } }],
    ])('reads %s', (_, filter, row, params) => {
        agrees(filter, row, params);
    });

    it('binds a nested entity key to its full path', () => {
        const nested = s.define('nested', {
            id: s.string().key(),
            address: s.object({ city: s.string() }),
        }).compile();

        const tree = toExpression(nested as never, ({ address: { city } }: any) => city === 'oslo') as any;

        expect(Expression.isNotParsable(tree)).toBe(false);
        expect(evaluate(tree, { address: { city: 'oslo' } } as never)).toBe(true);
        expect(evaluate(tree, { address: { city: 'bergen' } } as never)).toBe(false);
    });
});

describe('declarations inlined into the return', () => {

    it.each([
        ['a literal', (x: any) => { const min = 3; return x.age > min; }, { age: 4 }],
        ['a literal, not matching', (x: any) => { const min = 3; return x.age > min; }, { age: 2 }],
        ['let', (x: any) => { let min = 3; return x.age > min; }, { age: 4 }],
        ['var', (x: any) => { var min = 3; return x.age > min; }, { age: 4 }],
        ['two declarations', (x: any) => { const lo = 1; const hi = 9; return x.age > lo && x.age < hi; }, { age: 4 }],
        ['one declaration reading another', (x: any) => { const lo = 1; const hi = lo + 8; return x.age < hi; }, { age: 4 }],
        ['a property', (x: any) => { const who = x.name; return who === 'ada'; }, { name: 'ada' }],
        ['a property with a call on the use', (x: any) => { const who = x.name; return who.toLowerCase() === 'ada'; }, { name: 'ADA' }],
        ['a property with a comparator method on the use', (x: any) => { const who = x.name; return who.startsWith('a'); }, { name: 'ada' }],
        ['used twice', (x: any) => { const who = x.name; return who === 'ada' || who === 'bob'; }, { name: 'bob' }],
        ['no semicolon before the close', (x: any) => { const min = 3; return x.age > min }, { age: 4 }],
    ])('inlines %s', (_, filter, row) => {
        agrees(filter, row);
    });

    it('keeps an initializer at its own precedence, because the splice brackets it', () => {
        agrees((x: any) => { const min = 1 + 2; return x.age * 2 > min; }, { age: 2 });
        agrees((x: any) => { const min = 1 + 2; return x.age * 2 > min; }, { age: 1 });
    });
});

describe('if and else, as boolean algebra', () => {

    it.each([
        ['true then false is the condition itself', (x: any) => { if (x.age > 3) return true; return false; }, { age: 4 }],
        ['true then false, not matching', (x: any) => { if (x.age > 3) return true; return false; }, { age: 2 }],
        ['false then true is the negated condition', (x: any) => { if (x.age > 3) return false; return true; }, { age: 4 }],
        ['false then true, matching', (x: any) => { if (x.age > 3) return false; return true; }, { age: 2 }],
        ['a predicate then false', (x: any) => { if (x.age > 3) return x.name === 'ada'; return false; }, { age: 4, name: 'ada' }],
        ['a predicate then false, wrong name', (x: any) => { if (x.age > 3) return x.name === 'ada'; return false; }, { age: 4, name: 'bob' }],
        ['true then a predicate', (x: any) => { if (x.age > 3) return true; return x.name === 'ada'; }, { age: 1, name: 'ada' }],
        ['two predicates, first branch', (x: any) => { if (x.age > 3) return x.name === 'ada'; return x.name === 'bob'; }, { age: 4, name: 'ada' }],
        ['two predicates, second branch', (x: any) => { if (x.age > 3) return x.name === 'ada'; return x.name === 'bob'; }, { age: 1, name: 'bob' }],
        ['two predicates, neither', (x: any) => { if (x.age > 3) return x.name === 'ada'; return x.name === 'bob'; }, { age: 1, name: 'ada' }],
        ['an explicit else', (x: any) => { if (x.age > 3) return true; else return x.name === 'ada'; }, { age: 1, name: 'ada' }],
        ['blocks on both arms', (x: any) => { if (x.age > 3) { return true; } else { return x.name === 'ada'; } }, { age: 1, name: 'ada' }],
        ['an else-if chain', (x: any) => { if (x.age > 9) return true; else if (x.age > 3) return x.name === 'ada'; else return false; }, { age: 4, name: 'ada' }],
        ['an else-if chain falling to the last arm', (x: any) => { if (x.age > 9) return true; else if (x.age > 3) return x.name === 'ada'; else return x.name === 'bob'; }, { age: 1, name: 'bob' }],
        ['a declaration before the if', (x: any) => { const min = 3; if (x.age > min) return true; return false; }, { age: 4 }],
        ['a declaration inside a branch', (x: any) => { if (x.age > 3) { const who = 'ada'; return x.name === who; } return false; }, { age: 4, name: 'ada' }],
        ['a compound condition', (x: any) => { if (x.age > 3 && x.name === 'ada') return true; return false; }, { age: 4, name: 'ada' }],
        ['a compound condition negated by the swap', (x: any) => { if (x.age > 3 && x.name === 'ada') return false; return true; }, { age: 4, name: 'bob' }],
    ])('reads %s', (_, filter, row) => {
        agrees(filter, row);
    });

    it('does not let the negated copy of a condition flip the other branch', () => {
        const filter = (x: any) => { if (x.age > 3) return x.name === 'ada'; return x.name === 'bob'; };

        expect(answers(filter, { age: 4, name: 'ada' })).toBe(true);
        expect(answers(filter, { age: 4, name: 'bob' })).toBe(false);
        expect(answers(filter, { age: 1, name: 'bob' })).toBe(true);
        expect(answers(filter, { age: 1, name: 'ada' })).toBe(false);
    });

    it('refuses a block that falls off the end of an if, rather than guessing', () => {
        expect(Expression.isNotParsable(treeFor((x: any) => { if (x.age > 3) return true; }))).toBe(true);
    });
});

describe('switch, as the disjunction of its cases', () => {

    it.each([
        ['one case', (x: any) => { switch (x.name) { case 'ada': return true; default: return false; } }, { name: 'ada' }],
        ['one case, not matching', (x: any) => { switch (x.name) { case 'ada': return true; default: return false; } }, { name: 'zoe' }],
        ['two cases', (x: any) => { switch (x.name) { case 'ada': return true; case 'bob': return true; default: return false; } }, { name: 'bob' }],
        ['a fallthrough label', (x: any) => { switch (x.name) { case 'ada': case 'bob': return true; default: return false; } }, { name: 'bob' }],
        ['a fallthrough label, not matching', (x: any) => { switch (x.name) { case 'ada': case 'bob': return true; default: return false; } }, { name: 'zoe' }],
        ['a predicate in a case body', (x: any) => { switch (x.name) { case 'ada': return x.age > 3; default: return false; } }, { name: 'ada', age: 4 }],
        ['a predicate in a case body, failing it', (x: any) => { switch (x.name) { case 'ada': return x.age > 3; default: return false; } }, { name: 'ada', age: 1 }],
        ['a predicate in the default', (x: any) => { switch (x.name) { case 'ada': return true; default: return x.age > 3; } }, { name: 'zoe', age: 4 }],
        ['a predicate in the default, matched by a case instead', (x: any) => { switch (x.name) { case 'ada': return true; default: return x.age > 3; } }, { name: 'ada', age: 1 }],
        ['a case that breaks', (x: any) => { switch (x.name) { case 'ada': break; case 'bob': return true; default: return false; } }, { name: 'ada' }],
        ['a case that breaks, matching a later case', (x: any) => { switch (x.name) { case 'ada': break; case 'bob': return true; default: return false; } }, { name: 'bob' }],
        ['a case that returns false', (x: any) => { switch (x.name) { case 'ada': return false; default: return x.age > 3; } }, { name: 'ada', age: 4 }],
        ['no default at all', (x: any) => { switch (x.name) { case 'ada': return true; } return false; }, { name: 'ada' }],
        ['a default written first', (x: any) => { switch (x.name) { default: return x.age > 3; case 'ada': return true; } }, { name: 'zoe', age: 4 }],
        ['a numeric subject', (x: any) => { switch (x.age) { case 4: return true; default: return false; } }, { age: 4 }],
    ])('reads %s', (_, filter, row) => {
        agrees(filter, row);
    });

    it('refuses a break that falls into statements after the switch, which a disjunction cannot express', () => {
        const filter = (x: any) => { switch (x.name) { case 'ada': break; case 'bob': return false; } return true; };

        expect(Expression.isNotParsable(treeFor(filter))).toBe(true);
    });

    it('reads statements after a switch as its no-case-matched branch', () => {
        const filter = (x: any) => { switch (x.name) { case 'ada': return true; } return x.age > 3; };

        expect(answers(filter, { name: 'ada', age: 1 })).toBe(true);
        expect(answers(filter, { name: 'zoe', age: 4 })).toBe(true);
        expect(answers(filter, { name: 'zoe', age: 1 })).toBe(false);
    });

    it('guards the default with every case label, including one whose body matched nothing', () => {
        const filter = (x: any) => { switch (x.name) { case 'ada': return false; default: return x.age > 3; } };

        expect(answers(filter, { name: 'ada', age: 9 })).toBe(false);
        expect(answers(filter, { name: 'zoe', age: 9 })).toBe(true);
    });
});

describe('a comparison of two constants', () => {

    it('settles a params tautology to match-all, so it drops out of the filter', () => {
        const tree = treeFor(([_x, p]: any) => p.from === p.to, { from: 1, to: 1 });

        expect(Expression.isEmpty(tree)).toBe(true);
    });

    it('drops the settled half of a conjunction and keeps the rest', () => {
        const filter = ([x, p]: any) => p.from === p.to && x.age > 3;

        expect(answers(filter, { age: 4 }, { from: 1, to: 1 })).toBe(true);
        expect(answers(filter, { age: 1 }, { from: 1, to: 1 })).toBe(false);
    });

    /**
     * The same source with other params can be a tautology, so the refusal must never reach the
     * template cache — a cached NOT_PARSABLE would answer for every later params object too.
     */
    it('does not cache the refusal, because the next params can settle it the other way', () => {
        const filter = ([_x, p]: any) => p.from === p.to;

        expect(Expression.isNotParsable(treeFor(filter, { from: 1, to: 2 }))).toBe(true);
        expect(Expression.isEmpty(treeFor(filter, { from: 1, to: 1 }))).toBe(true);
    });

    it('refuses a constant comparison no row satisfies, because no node means match-nothing', () => {
        expect(Expression.isNotParsable(treeFor((_x: any) => false))).toBe(true);
        const constantFalse = new Function('return (x) => x.age > 3 && 1 === 2;')();

        expect(Expression.isNotParsable(treeFor(constantFalse))).toBe(true);
    });
});

describe('a call on a parenthesised value', () => {

    it.each([
        ['a casing method', (x: any) => (x.name).toLowerCase() === 'ada', { name: 'ADA' }],
        ['a locale casing method', (x: any) => (x.name).toLocaleLowerCase() === 'ada', { name: 'ADA' }],
        ['.length', (x: any) => (x.name).length > 2, { name: 'ada' }],
        ['.length on a grouped template', (x: any) => (`${x.name}${x.other}`).length > 4, { name: 'ada', other: 'bob' }],
        ['a chain of two calls', (x: any) => (x.name).toLowerCase().length === 3, { name: 'ADA' }],
        ['a comparator method on a grouped property', (x: any) => (x.name).startsWith('a'), { name: 'ada' }],
    ])('reads %s', (_, filter, row) => {
        agrees(filter, row);
    });

    it('still reads a parenthesised condition as a condition', () => {
        agrees((x: any) => (x.age > 3 || x.name === 'ada') && x.other === 'z', { age: 4, name: 'bob', other: 'z' });
    });
});
