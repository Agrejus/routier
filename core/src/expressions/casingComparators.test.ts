import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { evaluate } from './evaluate';
import { toExpression } from './parser';

/**
 * The predicates `parser.ts` used to refuse, on the grounds that "the plugins would silently ignore
 * them and return wrong data".
 *
 * The list is shared with `plugins/sql-core/src/casingComparators.test.ts` and
 * `plugins/mongodb/src/casingComparators.test.ts`. Each backend asserts its own rendering of the
 * same predicates; this file asserts the answer a row actually gets. Together they are what the
 * guard was protecting, and it could not be lifted until all three existed.
 */

const schema = s.define('casing', {
    id: s.string().key(),
    name: s.string(),
    other: s.string(),
}).compile();

const answers = (filter: (entity: any) => boolean, row: {}): boolean | undefined =>
    evaluate(toExpression(schema as never, filter as never, undefined as never), row as never);

describe('a casing call on a relational comparator', () => {

    it.each([
        ['equals, matching', (x: any) => x.name.toLowerCase() === 'ada', { name: 'ADA' }, true],
        ['equals, not matching', (x: any) => x.name.toLowerCase() === 'ada', { name: 'BOB' }, false],
        ['equals is case-folded, not case-blind', (x: any) => x.name.toLowerCase() === 'ADA', { name: 'ADA' }, false],
        ['upper-case equals', (x: any) => x.name.toUpperCase() === 'ADA', { name: 'ada' }, true],
        ['greater-than', (x: any) => x.name.toUpperCase() > 'M', { name: 'zoe' }, true],
        ['greater-than, below', (x: any) => x.name.toUpperCase() > 'M', { name: 'ada' }, false],
        ['less-than-equals', (x: any) => x.name.toLowerCase() <= 'b', { name: 'ADA' }, true],
    ])('answers %s', (_, filter, row, expected) => {
        expect(answers(filter, row)).toBe(expected);
    });

    it('compares two properties through the call on both sides', () => {
        expect(answers((x: any) => x.name.toLowerCase() === x.other.toLowerCase(), { name: 'ADA', other: 'ada' })).toBe(true);
        expect(answers((x: any) => x.name.toLowerCase() === x.other.toLowerCase(), { name: 'ADA', other: 'bob' })).toBe(false);
    });

    it('compares a called property against a plain one', () => {
        expect(answers((x: any) => x.name === x.other.toLowerCase(), { name: 'ada', other: 'ADA' })).toBe(true);
    });

    // A call on an absent value has no answer, and returning `false` would exclude a row on the
    // strength of a comparison that never happened
    it('has no answer when the value is absent', () => {
        expect(answers((x: any) => x.name.toLowerCase() === 'ada', {})).toBeUndefined();
    });
});
