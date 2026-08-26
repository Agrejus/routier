import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { toExpression } from './index';

/**
 * Which predicates the parser can turn into an expression tree — pinned, not aspirational.
 *
 * A predicate it cannot parse is not an error and nothing fails. The filter runs correctly in
 * memory, AFTER the backend has returned every row, so a bounded query quietly becomes a full
 * read. That silence is why this is written down: the coverage map is a fact about performance,
 * and it should not be possible to change it by accident.
 *
 * This is a CHARACTERISATION test. It records what happens today, including the things that do
 * not work. Widening the parser is supposed to fail it — change the expectation in the same
 * commit, so `specs/parser-coverage.md` and the parser cannot drift apart.
 */

const schema = s.define('coverage_probe', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
    active: s.boolean(),
    createdAt: s.date(),
    tags: s.array(s.string()),
}).compile();

const parses = (filter: unknown): boolean =>
    (toExpression(schema as never, filter as never, undefined as never) as { type?: string }).type !== 'not-parsable';

describe('what the parser supports', () => {

    it.each([
        ['startsWith', (x: any) => x.name.startsWith('a')],
        ['endsWith', (x: any) => x.name.endsWith('z')],
        ['includes on a string', (x: any) => x.name.includes('d')],
        ['casing inside a string match', (x: any) => x.name.toLowerCase().startsWith('a')],
        ['string length', (x: any) => x.name.length > 3],
        ['array length', (x: any) => x.tags.length > 0],
        ['array membership', (x: any) => x.tags.includes('featured')],
        ['literal membership, which becomes IN', (x: any) => ['a', 'b'].includes(x.name)],
        ['a bare boolean', (x: any) => x.active],
        ['a negated boolean', (x: any) => !x.active],
        ['an explicit boolean comparison', (x: any) => x.active === true],
        ['optional chaining', (x: any) => x.name?.length > 2],
        ['both operand orders', (x: any) => 18 < x.age],
    ])('parses %s', (_, filter) => {
        expect(parses(filter)).toBe(true);
    });
});

/**
 * `parser.ts:1016` refuses a casing transformer with anything but a string-matching comparator,
 * on the stated grounds that "the plugins would silently ignore them and return wrong data".
 *
 * That reason no longer holds. `toSql` wraps the column in `LOWER(...)` for every comparator,
 * `toMql` has the `$expr` path with `$toLower`, and `evaluate.ts` applies the transformer in
 * `applyTransformer`. The parser is refusing a tree the whole stack can handle, which leaves
 * `toSql`'s `LOWER` path unreachable for relational comparators.
 *
 * Pinned as failing so that lifting the guard is a deliberate act with a diff, not a surprise.
 * See `specs/parser-coverage.md`.
 */
describe('the stale casing guard', () => {

    it.each([
        ['toLowerCase with ===', (x: any) => x.name.toLowerCase() === 'ada'],
        ['toUpperCase with ===', (x: any) => x.name.toUpperCase() === 'ADA'],
    ])('does NOT parse %s, though every backend could execute it', (_, filter) => {
        expect(parses(filter)).toBe(false);
    });
});

describe('what the parser does not support', () => {

    /** Each has a direct equivalent in SQL and Mongo. A table entry plus three renders. */
    it.each([
        ['trim', (x: any) => x.name.trim() === 'ada'],
        ['indexOf on a string', (x: any) => x.name.indexOf('a') === 0],
        ['slice', (x: any) => x.name.slice(0, 2) === 'ad'],
        ['substring', (x: any) => x.name.substring(0, 2) === 'ad'],
        ['charAt', (x: any) => x.name.charAt(0) === 'a'],
        ['at on a string', (x: any) => x.name.at(0) === 'a'],
        ['Math.abs', (x: any) => Math.abs(x.age) > 3],
        ['Math.floor', (x: any) => Math.floor(x.age) > 3],
        ['Date getTime', (x: any) => x.createdAt.getTime() > 0],
        ['Date getFullYear', (x: any) => x.createdAt.getFullYear() === 2026],
    ])('does not parse %s, which has an equivalent everywhere', (_, filter) => {
        expect(parses(filter)).toBe(false);
    });

    /** A nested predicate over elements — `EXISTS`/`json_each` in SQL, `$elemMatch` in Mongo. */
    it.each([
        ['some', (x: any) => x.tags.some((t: string) => t === 'a')],
        ['every', (x: any) => x.tags.every((t: string) => t !== '')],
        ['find', (x: any) => x.tags.find((t: string) => t === 'a') != null],
        ['indexOf on an array', (x: any) => x.tags.indexOf('a') >= 0],
    ])('does not parse array iteration: %s', (_, filter) => {
        expect(parses(filter)).toBe(false);
    });

    /** These fail in the TOKENIZER or the grammar, so no lookup entry could fix them. */
    it.each([
        ['modulo', (x: any) => x.age % 2 === 0],
        ['addition', (x: any) => x.age + 1 > 3],
        ['multiplication', (x: any) => x.age * 2 > 3],
        ['a ternary', (x: any) => (x.age > 5 ? x.name : '') === 'ada'],
        ['nullish coalescing', (x: any) => (x.name ?? '') === 'ada'],
        ['a regex literal', (x: any) => /^a/.test(x.name)],
    ])('does not parse %s, which is a grammar gap rather than a missing method', (_, filter) => {
        expect(parses(filter)).toBe(false);
    });

    /**
     * The parser sees an identifier it cannot evaluate and stops. `new Date(0)` is the one that
     * bites: comparing a date property to a constructed date is ordinary, and the workaround —
     * passing it through params — works but is not discoverable.
     */
    it.each([
        ['typeof', (x: any) => typeof x.name === 'string'],
        ['a constructed Date', (x: any) => x.createdAt > new Date(0)],
        ['Number.isInteger', (x: any) => Number.isInteger(x.age)],
    ])('does not parse %s, because the value comes from a free identifier', (_, filter) => {
        expect(parses(filter)).toBe(false);
    });

    /** Refusing these is correct: they produce values no index can use. */
    it.each([
        ['split', (x: any) => x.name.split(',').length > 1],
        ['replace', (x: any) => x.name.replace('a', 'b') === 'bda'],
        ['padStart', (x: any) => x.name.padStart(5, ' ') === '  ada'],
        ['localeCompare', (x: any) => x.name.localeCompare('ada') === 0],
        ['toFixed', (x: any) => x.age.toFixed(2) === '1.00'],
    ])('does not parse %s, and should not', (_, filter) => {
        expect(parses(filter)).toBe(false);
    });
});
