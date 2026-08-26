import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '../schema';
import { logger } from '../utilities';
import { toExpression } from './parser';
import { ComparatorExpression, Expression, OperatorExpression, PropertyExpression, ValueExpression } from './types';
import { peelCalls } from './utils';

/**
 * The 2026-08 query-language expansion: syntax that used to silently fall back to
 * in-memory execution (or, for escapes, parse to the WRONG value) and now parses.
 *
 * - `\u` / `\x` string escapes decode to their character
 * - scientific/hex/binary/octal/separator numeric literals
 * - classic `function` expressions (what ES5 transpilers emit)
 * - `!` on compound expressions via De Morgan
 * - inline array membership: `["a", "b"].includes(r.prop)`
 * - property-to-property comparison: `r.a === r.b`
 * - `.length` on string/array properties
 * - constant `true` filters parse to EMPTY
 * - parse failures are cached: one parse, one warning, per schema + source
 */

const schema = s.define('expanded_syntax', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
    other: s.string(),
    tags: s.array(s.string()),
}).compile();

const fromSource = (source: string, args = 'r') =>
    new Function(`return (${args}) => ${source};`)() as any;

const withSource = (source: string) => {
    const fn: any = () => true;
    fn.toString = () => source;
    return fn;
};

function parsed(fn: any, params?: any): ComparatorExpression {
    const result = params === undefined
        ? toExpression(schema as any, fn)
        : toExpression(schema as any, fn, params);

    expect(result).not.toStrictEqual(Expression.NOT_PARSABLE);
    return result as ComparatorExpression;
}

function rejected(fn: any, params?: any) {
    const result = params === undefined
        ? toExpression(schema as any, fn)
        : toExpression(schema as any, fn, params);

    expect(result).toStrictEqual(Expression.NOT_PARSABLE);
}

describe('unicode and hex string escapes', () => {
    it('decodes \\uXXXX to its character', () => {
        // Source text contains backslash-u, exactly as Function.prototype.toString
        // preserves it; the tokenizer must decode it to "A", not the literal "u0041".
        const cmp = parsed(withSource('(r) => r.name === "\\u0041"'));
        expect((cmp.right as ValueExpression).value).toBe('A');
    });

    it('decodes \\u{...} code points beyond the BMP', () => {
        const cmp = parsed(withSource('(r) => r.name === "\\u{1F600}"'));
        expect((cmp.right as ValueExpression).value).toBe('\u{1F600}');
    });

    it('decodes \\xXX to its character', () => {
        const cmp = parsed(withSource('(r) => r.name === "\\xE9"'));
        expect((cmp.right as ValueExpression).value).toBe('\xE9');
    });

    it('rejects a malformed unicode escape instead of corrupting the value', () => {
        rejected(withSource('(r) => r.name === "\\uZZ99"'));
    });
});

describe('numeric literal forms', () => {
    it.each([
        ['scientific', '1e6', 1e6],
        ['scientific with sign', '1.5e-3', 1.5e-3],
        ['scientific uppercase', '2E+2', 2E+2],
        ['hex', '0xFF', 0xFF],
        ['binary', '0b1010', 0b1010],
        ['octal', '0o17', 0o17],
        ['separators', '1_000_000', 1_000_000],
        ['separators with decimals', '1_000.5', 1_000.5],
        ['plain zero', '0', 0],
    ])('parses %s (%s)', (_name, literal, value) => {
        const cmp = parsed(fromSource(`r.price === ${literal}`));
        expect((cmp.right as ValueExpression).value).toBe(value);
    });

    it('still rejects an identifier fused to a number', () => {
        rejected(withSource('(r) => r.price === 1x2'));
    });
});

describe('classic function expressions', () => {
    it('parses an anonymous function', () => {
        // eslint-disable-next-line prefer-arrow-callback
        const cmp = parsed(function (r: any) { return r.price > 5; });
        expect(cmp.comparator).toBe('greater-than');
    });

    it('parses a named function', () => {
        // eslint-disable-next-line prefer-arrow-callback
        const cmp = parsed(function myFilter(r: any) { return r.name === 'a'; });
        expect(cmp.comparator).toBe('equals');
    });

    it('parses a destructured params function', () => {
        // eslint-disable-next-line prefer-arrow-callback
        const cmp = parsed(function ([r, p]: any) { return r.name === p.term; }, { term: 'x' });
        expect((cmp.right as ValueExpression).value).toBe('x');
    });
});

describe("'!' on compound expressions (De Morgan)", () => {
    it('negating a conjunction flips it to a disjunction of negations', () => {
        const expr = parsed(fromSource('!(r.price > 1 && r.name === "x")')) as unknown as OperatorExpression;

        expect(expr.operator).toBe('||');
        expect((expr.left as ComparatorExpression).comparator).toBe('greater-than');
        expect((expr.left as ComparatorExpression).negated).toBe(true);
        expect((expr.right as ComparatorExpression).comparator).toBe('equals');
        expect((expr.right as ComparatorExpression).negated).toBe(true);
    });

    it('negating a disjunction flips it to a conjunction of negations', () => {
        const expr = parsed(fromSource('!(r.price > 1 || r.active)')) as unknown as OperatorExpression;

        expect(expr.operator).toBe('&&');
        expect((expr.left as ComparatorExpression).negated).toBe(true);
        expect((expr.right as ComparatorExpression).negated).toBe(true);
    });

    it('double negation cancels out', () => {
        const expr = parsed(fromSource('!!(r.price > 1 && r.active)')) as unknown as OperatorExpression;

        expect(expr.operator).toBe('&&');
        expect((expr.left as ComparatorExpression).negated).toBe(false);
        expect((expr.right as ComparatorExpression).negated).toBe(false);
    });

    it('distributes through nested compounds', () => {
        const expr = parsed(fromSource('!((r.price > 1 && r.active) || r.name === "x")')) as unknown as OperatorExpression;

        expect(expr.operator).toBe('&&');
        expect((expr.left as OperatorExpression).operator).toBe('||');
    });
});

describe('inline array membership', () => {
    it('parses ["a", "b"].includes(r.prop) as an includes comparator with the array on the left', () => {
        const cmp = parsed(fromSource('["active", "pending"].includes(r.name)'));

        expect(cmp.comparator).toBe('includes');
        expect((cmp.left as ValueExpression).value).toEqual(['active', 'pending']);
        expect((peelCalls(cmp.right)?.operand as PropertyExpression).property.name).toBe('name');
    });

    it('parses a numeric array', () => {
        const cmp = parsed(fromSource('[1, 2, 3].includes(r.price)'));
        expect((cmp.left as ValueExpression).value).toEqual([1, 2, 3]);
    });

    it('negates through !', () => {
        const cmp = parsed(fromSource('![1, 2].includes(r.price)'));
        expect(cmp.negated).toBe(true);
    });

    it('folds === false into negation', () => {
        const cmp = parsed(fromSource('["a"].includes(r.name) === false'));
        expect(cmp.negated).toBe(true);
    });

    it('rejects a non-literal element', () => {
        rejected(fromSource('[someVar].includes(r.name)'));
    });

    it('rejects methods other than includes on an array literal', () => {
        rejected(fromSource('["a"].some(r.name)'));
    });
});

describe('property-to-property comparison', () => {
    it('parses equality with a property expression on each side', () => {
        const cmp = parsed(fromSource('r.name === r.other'));

        expect(cmp.comparator).toBe('equals');
        expect((peelCalls(cmp.left)?.operand as PropertyExpression).property.name).toBe('name');
        expect((peelCalls(cmp.right)?.operand as PropertyExpression).property.name).toBe('other');
    });

    it('parses relational comparison without swapping sides', () => {
        const cmp = parsed(fromSource('r.price > r.price'));
        expect(cmp.comparator).toBe('greater-than');
    });

    it('negates through !==', () => {
        const cmp = parsed(fromSource('r.name !== r.other'));
        expect(cmp.negated).toBe(true);
        expect(cmp.strict).toBe(true);
    });

    it('parses a casing call on either side', () => {
        expect(peelCalls(parsed(fromSource('r.name.toLowerCase() === r.other')).left)?.calls.map(c => c.call)).toEqual(['to-lower-case']);
        expect(peelCalls(parsed(fromSource('r.name === r.other.toLowerCase()')).right)?.calls.map(c => c.call)).toEqual(['to-lower-case']);
    });
});

describe('.length on strings and arrays', () => {
    it('parses string length as a length transformer with a numeric value', () => {
        const cmp = parsed(fromSource('r.name.length > 5'));

        expect((peelCalls(cmp.left)?.operand as PropertyExpression).property.name).toBe('name');
        expect(peelCalls(cmp.left)?.calls.map(c => c.call)).toEqual(['length']);
        expect((cmp.right as ValueExpression).value).toBe(5);
    });

    it('parses array length equality', () => {
        const cmp = parsed(fromSource('r.tags.length === 0'));

        expect(peelCalls(cmp.left)?.calls.map(c => c.call)).toEqual(['length']);
        expect((cmp.right as ValueExpression).value).toBe(0);
    });

    it('keeps the compared value a number for string properties', () => {
        // Without the length transformer, a value paired with a String property is
        // converted to a string — "5" instead of 5 — which breaks SQL comparison.
        const cmp = parsed(fromSource('r.name.length === 5'));
        expect((cmp.right as ValueExpression).value).toBe(5);
    });

    it('translates truthy shorthand to length > 0', () => {
        const cmp = parsed(fromSource('r.tags.length'));

        expect(cmp.comparator).toBe('greater-than');
        expect((cmp.right as ValueExpression).value).toBe(0);
    });

    it('negated truthy shorthand means length <= 0', () => {
        const cmp = parsed(fromSource('!r.tags.length'));

        expect(cmp.comparator).toBe('greater-than');
        expect(cmp.negated).toBe(true);
    });

    it('compares length via params', () => {
        const cmp = parsed(fromSource('r.name.length >= p.min', '[r, p]'), { min: 3 });
        expect((cmp.right as ValueExpression).value).toBe(3);
    });

    it('rejects .length inside a string-matching comparator', () => {
        rejected(fromSource('r.name.length.startsWith("1")'));
    });

    it('prefers a real schema property named length', () => {
        const lengthSchema = s.define('expanded_syntax_length_prop', {
            id: s.string().key(),
            box: s.object({ length: s.number() }),
        }).compile();

        const result = toExpression(lengthSchema as any, ((r: any) => r.box.length === 5) as any) as ComparatorExpression;

        expect(result).not.toStrictEqual(Expression.NOT_PARSABLE);
        expect(peelCalls(result.left)?.calls.map(c => c.call)).toEqual([]);
        expect((result.left as PropertyExpression).property.getAssignmentPath()).toBe('box.length');
    });
});

describe('constant true filters', () => {
    it('x => true parses to EMPTY', () => {
        const result = toExpression(schema as any, ((r: any) => true) as any);
        expect(Expression.isEmpty(result)).toBe(true);
    });

    it('true && <condition> simplifies to the condition', () => {
        const cmp = parsed(fromSource('true && r.price > 1'));
        expect(cmp.comparator).toBe('greater-than');
    });

    it('<condition> && true simplifies to the condition', () => {
        const cmp = parsed(fromSource('r.price > 1 && true'));
        expect(cmp.comparator).toBe('greater-than');
    });

    it('<condition> || true absorbs to EMPTY', () => {
        const result = toExpression(schema as any, fromSource('r.price > 1 || true'));
        expect(Expression.isEmpty(result)).toBe(true);
    });

    it('true compared as a value still works', () => {
        const cmp = parsed(fromSource('r.active === true'));
        expect((cmp.right as ValueExpression).value).toBe(true);
    });

    it('x => false still rejects', () => {
        rejected(fromSource('false'));
    });
});

describe('parse failure caching', () => {
    let warn: any;

    beforeEach(() => {
        warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warn.mockRestore();
    });

    it('parses an unsupported filter once and warns once', () => {
        const cacheSchema = s.define('expanded_syntax_cache', {
            id: s.string().key(),
            name: s.string(),
        }).compile();
        const unsupported = fromSource('r.name.padEnd(3) === "x"');

        expect(toExpression(cacheSchema as any, unsupported)).toStrictEqual(Expression.NOT_PARSABLE);
        expect(toExpression(cacheSchema as any, unsupported)).toStrictEqual(Expression.NOT_PARSABLE);
        expect(toExpression(cacheSchema as any, unsupported)).toStrictEqual(Expression.NOT_PARSABLE);

        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not cache param-dependent failures', () => {
        const cacheSchema = s.define('expanded_syntax_param_cache', {
            id: s.string().key(),
            name: s.string(),
        }).compile();
        const filter = fromSource('r.name === p.term', '[r, p]');

        // Wrong params fail...
        expect(toExpression(cacheSchema as any, filter, { other: 1 })).toStrictEqual(Expression.NOT_PARSABLE);

        // ...but the same source with the right params must still parse.
        const bound = toExpression(cacheSchema as any, filter, { term: 'x' }) as ComparatorExpression;
        expect(bound).not.toStrictEqual(Expression.NOT_PARSABLE);
        expect((bound.right as ValueExpression).value).toBe('x');
    });
});
