import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { toExpression } from './index';

/**
 * Which predicates the parser can turn into an expression tree.
 *
 * A predicate it cannot parse is not an error and nothing fails. The filter runs correctly in
 * memory, AFTER the backend has returned every row, so a bounded query quietly becomes a full
 * read. That silence is why coverage is worth testing at all.
 *
 * Supported forms are asserted. Everything the parser cannot do yet is a `todo` naming the
 * predicate that should work — a work list that shows up every test run, not an assertion that
 * the gap is correct. Implementing one means replacing its `todo` with a real test, never
 * inverting an expectation.
 *
 * Measured against `specs/parser-coverage.md`, which groups the gaps by root cause.
 */

const schema = s.define('coverage_probe', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
    active: s.boolean(),
    deletedAt: s.date().nullable(),
    createdAt: s.date(),
    tags: s.array(s.string()),
    address: s.object({ city: s.string(), zip: s.object({ code: s.string() }) }),
}).compile();

const parses = (filter: unknown, params?: unknown): boolean =>
    (toExpression(schema as never, filter as never, params as never) as { type?: string }).type !== 'not-parsable';

describe('supported: comparison and logic', () => {

    it.each([
        ['every comparison operator', (x: any) => x.age > 1 && x.age >= 1 && x.age < 9 && x.age <= 9],
        ['strict and loose equality', (x: any) => x.age === 1 || x.age == 1 || x.age !== 2 || x.age != 2],
        ['either operand order', (x: any) => 18 < x.age],
        ['parenthesised groups', (x: any) => (x.age > 3 && x.active) || x.name === 'a'],
        ['a negated group', (x: any) => !(x.age > 3 && x.active)],
        ['a long or chain', (x: any) => x.age === 1 || x.age === 2 || x.age === 3 || x.age === 4],
        ['mixed and/or', (x: any) => x.age === 1 || (x.active && x.name === 'a')],
        ['a property compared to another property', (x: any) => x.name === x.id],
        ['a relational property-to-property comparison', (x: any) => x.age > x.age],
    ])('parses %s', (_, filter) => expect(parses(filter)).toBe(true));
});

describe('supported: syntax forms', () => {

    it.each([
        ['a block body with one return', (x: any) => { return x.age > 3; }],
        ['bracket access', (x: any) => x['name'] === 'a'],
        ['a plain template literal', (x: any) => x.name === `ada`],
        ['a comment inside the predicate', (x: any) => x.age > 3],
        ['unary minus', (x: any) => x.age > -1],
        ['double negation', (x: any) => !!x.active],
        ['optional chaining', (x: any) => x.name?.length > 2],
        ['optional chaining through a nested path', (x: any) => x.address?.zip?.code === '123'],
        ['x => true, which is the tautology', (x: any) => true],
    ])('parses %s', (_, filter) => expect(parses(filter)).toBe(true));
});

describe('supported: properties and values', () => {

    it.each([
        ['a nested property', (x: any) => x.address.city === 'york'],
        ['a property nested two levels', (x: any) => x.address.zip.code === '123'],
        ['null, either side', (x: any) => x.deletedAt === null || null === x.deletedAt],
        ['not-null, strict and loose', (x: any) => x.deletedAt !== null && x.deletedAt != null],
        ['undefined', (x: any) => x.deletedAt === undefined],
        ['numeric literals including zero, floats and negatives', (x: any) => x.age === 0 || x.age === 3.5 || x.age === -3],
        ['an empty string', (x: any) => x.name === ''],
        ['a string containing a quote', (x: any) => x.name === "it's"],
        ['a boolean literal', (x: any) => x.active === false],
        ['a bare boolean', (x: any) => x.active],
        ['a negated boolean', (x: any) => !x.active],
        ['a date property against a string literal', (x: any) => x.createdAt > '2020-01-01'],
    ])('parses %s', (_, filter) => expect(parses(filter)).toBe(true));
});

describe('supported: string and array methods', () => {

    it.each([
        ['startsWith', (x: any) => x.name.startsWith('a')],
        ['endsWith', (x: any) => x.name.endsWith('z')],
        ['includes on a string', (x: any) => x.name.includes('d')],
        ['startsWith on a nested property', (x: any) => x.address.city.startsWith('y')],
        ['casing inside a string match', (x: any) => x.name.toLowerCase().startsWith('a')],
        ['casing inside a match on a nested property', (x: any) => x.address.city.toLowerCase().startsWith('y')],
        ['string length', (x: any) => x.name.length > 3],
        ['array length', (x: any) => x.tags.length > 0],
        ['length compared to zero', (x: any) => x.tags.length === 0],
        ['length on a nested property', (x: any) => x.address.city.length > 3],
        ['array membership', (x: any) => x.tags.includes('featured')],
        ['literal membership, which becomes IN', (x: any) => ['a', 'b'].includes(x.name)],
        ['literal membership over numbers', (x: any) => [1, 2].includes(x.age)],
    ])('parses %s', (_, filter) => expect(parses(filter)).toBe(true));
});

describe('supported: params', () => {

    it.each([
        ['a simple param', ([x, p]: any) => x.age > p.min, { min: 3 }],
        ['two params', ([x, p]: any) => x.age > p.min && x.name === p.name, { min: 3, name: 'a' }],
        ['a nested param path', ([x, p]: any) => x.age > p.range.min, { range: { min: 3 } }],
        ['one param used twice', ([x, p]: any) => x.age > p.n && x.age < p.n, { n: 3 }],
        ['a param array in includes', ([x, p]: any) => p.names.includes(x.name), { names: ['a'] }],
        ['a param inside an array includes', ([x, p]: any) => x.tags.includes(p.tag), { tag: 'a' }],
        ['a Date param', ([x, p]: any) => x.createdAt > p.since, { since: new Date(0) }],
        ['a param in startsWith', ([x, p]: any) => x.name.startsWith(p.q), { q: 'a' }],
        ['a param in a cased includes', ([x, p]: any) => x.name.toLowerCase().includes(p.q), { q: 'a' }],
        ['length against a param', ([x, p]: any) => x.tags.length > p.n, { n: 1 }],
        ['a nested property against a param', ([x, p]: any) => x.address.city === p.c, { c: 'y' }],
    ])('parses %s', (_, filter, params) => expect(parses(filter, params)).toBe(true));
});

/**
 * Everything below is a gap, written as the predicate that SHOULD parse.
 *
 * Grouped by root cause rather than by symptom, because several of these are one fix. See
 * `specs/parser-coverage.md`.
 */

/**
 * `parser.ts:1016` and `parser.ts:911` refuse a casing transformer with anything but a
 * string-matching comparator, on the stated grounds that "the plugins would silently ignore them
 * and return wrong data".
 *
 * That reason no longer holds. Removing the 1016 guard and changing nothing else was verified end
 * to end: the parser produces a well-formed tree, `Expression.toJson`/`fromJson` preserve the
 * transformer, `evaluate.ts` answers correctly, `toSql` emits `LOWER("name") = ?` in all three
 * dialects, and `toMql` emits `{$expr:{$eq:[{$toLower:"$name"},...]}}`. The 911 case
 * (property-to-property) is unverified and needs the same treatment before it is lifted.
 */
describe('to support: the stale casing guards', () => {
    it.todo("x.name.toLowerCase() === 'ada'");
    it.todo("x.name.toUpperCase() === 'ADA'");
    it.todo('x.name.toLowerCase() === x.id.toLowerCase()');
});

/**
 * ONE root cause: the parser has no notion of globals, so any identifier it cannot resolve to the
 * entity or the params object fails with "Cannot derive value from variable". A safe allow-list of
 * globals to constant-fold closes all of these at once.
 *
 * `x.createdAt > new Date(0)` is the one that bites — an ordinary query that silently becomes a
 * full read. Passing the date through params works and is not discoverable.
 */
describe('to support: free identifiers', () => {
    it.todo('Math.abs(x.age) > 3');
    it.todo('Math.floor(x.age) > 3');
    it.todo('Math.ceil / Math.round');
    it.todo('Number.isInteger(x.age)');
    it.todo('x.createdAt > new Date(0)');
    it.todo('x.age < Infinity');
    it.todo('Boolean(x.active)');
    it.todo("String(x.age) === '1'");
    it.todo('Number(x.name) > 1');
    it.todo("typeof x.name === 'string'");
    it.todo('an async arrow predicate');
});

/** Fail in the tokenizer or the grammar, so no lookup entry can fix them. */
describe('to support: grammar', () => {
    it.todo('x.age % 2 === 0');
    it.todo('x.age + 1 > 3');
    it.todo('x.price * 1.2 > 100');
    it.todo('subtraction and division');
    it.todo("(x.age > 5 ? x.name : '') === 'ada' — a ternary");
    it.todo("(x.name ?? '') === 'ada' — nullish coalescing");
    it.todo('/^a/.test(x.name) — a regex literal');
    it.todo("'name' in x — the in operator");
    it.todo("[...names].includes(x.name) — a spread");
    it.todo('`${p.prefix}a` — template literal interpolation');
});

/** Ordinary JavaScript someone writes without thinking. Parser-side only, no translator work. */
describe('to support: function shapes', () => {
    it.todo("({ name }) => name === 'a' — a destructured entity");
    it.todo('{ const n = 3; return x.age > n; } — a multi-statement block');
    it.todo('{ if (...) return true; return false; } — an if statement');

    /**
     * An asymmetry rather than a plain gap: `x => true` parses to the `empty` tautology and
     * `toSql` renders it `1 = 1`, but `x => false` is refused and there is no match-nothing
     * counterpart anywhere in the stack.
     */
    it.todo('x => false — the match-nothing counterpart of the tautology');

    it.todo('p.a === p.b — a comparison referencing no schema property');
});

/** Direct equivalents in SQL and Mongo. A parser table entry plus a render in three translators. */
describe('to support: methods with equivalents everywhere', () => {
    it.todo("x.name.trim() === 'ada' — TRIM / $trim");
    it.todo("x.name.indexOf('a') === 0 — INSTR / $indexOfCP");
    it.todo("x.name.slice(0, 2) === 'ad' — SUBSTR / $substrCP");
    it.todo('x.name.substring(0, 2)');
    it.todo('x.name.charAt(0) / x.name.at(0)');
    it.todo('x.createdAt.getFullYear() === 2026 — EXTRACT / $year');
    it.todo('x.createdAt.getTime() > 0');
    it.todo('getMonth / getDate / getHours');
});

/** A nested predicate over elements: `EXISTS`/`json_each` in SQL, `$elemMatch` in Mongo. */
describe('to support: array iteration', () => {
    it.todo("x.tags.some(t => t === 'a') — $elemMatch / EXISTS");
    it.todo("x.tags.every(t => t !== '')");
    it.todo("x.tags.find(t => t === 'a') != null");
    it.todo("x.tags.indexOf('a') >= 0");
    it.todo('x.tags.at(0)');
    it.todo("x.tags.join(',')");
});

/**
 * Supportable, but of doubtful value: each produces a computed value no index can use, so pushing
 * it down may be slower than the memory fallback it replaces. Worth deciding deliberately rather
 * than by omission — and `.explain()` now says when one of these sent a query to memory.
 */
describe('to support, or decide against deliberately', () => {
    it.todo("x.name.split(',').length > 1");
    it.todo("x.name.replace('a', 'b') === 'bda'");
    it.todo("x.name.padStart(5, ' ')");
    it.todo("x.name.localeCompare('ada') === 0");
    it.todo("x.age.toFixed(2) === '1.00'");
    it.todo('x.name.match(/a/) != null');
});
