import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { toExpression } from './parser';
import { ComparatorExpression, Expression, ValueExpression } from './types';

/**
 * Tests written to kill specific surviving mutants from the `mutate:expressions` run.
 *
 * Each group states the mutant it targets. They are direct rather than exploratory: a
 * surviving mutant names an exact behavior nothing asserted, so the test that kills it is
 * the missing assertion, not a new scenario.
 */

const schema = s.define('mutant_target', {
    id: s.string().key(),
    price: s.number().nullable(),
    name: s.string().nullable(),
    active: s.boolean().nullable(),
}).compile();

/** The comparator's right-hand value, as the parser resolved it. */
function comparatorValue(expression: Expression): unknown {
    expect(expression).toBeInstanceOf(ComparatorExpression);
    const comparator = expression as ComparatorExpression;
    const right = comparator.right as ValueExpression;
    return right?.value;
}

describe('value coercion preserves null', () => {
    // Kills: `v == null ? v : Number(v)` -> `false ? v : Number(v)`.
    // Without the null guard the parser coerces null to 0, so `price === null` silently
    // becomes `price === 0` and matches the wrong rows.
    it('does not coerce null to 0 for a number property', () => {
        const expression = toExpression(schema as any, (p: any) => p.price === null);

        expect(comparatorValue(expression)).toBeNull();
        expect(comparatorValue(expression)).not.toBe(0);
    });

    // Kills: `v == null ? v : String(v)` -> `true ? v : String(v)` and the `false` variant.
    // Coercing null here would turn `name === null` into `name === "null"`.
    it('does not coerce null to the string "null" for a string property', () => {
        const expression = toExpression(schema as any, (p: any) => p.name === null);

        expect(comparatorValue(expression)).toBeNull();
        expect(comparatorValue(expression)).not.toBe('null');
    });

    // Kills: `v == null ? v : Boolean(v)` -> `false ? v : Boolean(v)`.
    // Coercing null would turn `active === null` into `active === false`, which matches
    // every row that is explicitly false.
    it('does not coerce null to false for a boolean property', () => {
        const expression = toExpression(schema as any, (p: any) => p.active === null);

        expect(comparatorValue(expression)).toBeNull();
        expect(comparatorValue(expression)).not.toBe(false);
    });

    it('still coerces a non-null number value', () => {
        // The guard must not disable coercion outright — only skip it for null.
        expect(comparatorValue(toExpression(schema as any, (p: any) => p.price === 5))).toBe(5);
    });

    it('still coerces a non-null string value', () => {
        expect(comparatorValue(toExpression(schema as any, (p: any) => p.name === 'abc'))).toBe('abc');
    });

    it('still coerces a non-null boolean value', () => {
        expect(comparatorValue(toExpression(schema as any, (p: any) => p.active === true))).toBe(true);
    });
});

describe('tokenizer whitespace handling', () => {
    // Kills: each disjunct of
    // `char === " " || char === "\t" || char === "\r" || char === "\n"` -> false.
    // Every filter in the existing suite is written with plain spaces, so the tab, carriage
    // return, and newline branches were never exercised — a formatter emitting tabs would
    // have broken parsing with nothing to catch it.
    const reference = toExpression(schema as any, (p: any) => p.price === 5);

    /** Builds a filter whose source uses the given whitespace character between tokens. */
    function parseWithWhitespace(whitespace: string) {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (p) =>${whitespace}p.price${whitespace}===${whitespace}5;`)();
        return toExpression(schema as any, fn);
    }

    it.each([
        ['tab', '\t'],
        ['carriage return', '\r'],
        ['newline', '\n'],
        ['space', ' '],
        ['mixed', ' \t\r\n '],
    ])('parses a filter separated by %s identically to one separated by spaces', (_label, whitespace) => {
        const expression = parseWithWhitespace(whitespace);

        expect(expression).not.toHaveProperty('type', 'not-parsable');
        expect(comparatorValue(expression)).toBe(5);
        expect((expression as ComparatorExpression).comparator)
            .toBe((reference as ComparatorExpression).comparator);
    });

    it('parses a filter with no whitespace at all', () => {
        // eslint-disable-next-line no-new-func
        const fn = new Function('return (p)=>p.price===5;')();

        expect(comparatorValue(toExpression(schema as any, fn))).toBe(5);
    });
});
