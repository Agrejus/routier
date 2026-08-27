import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { toExpression } from './parser';
import { Expression } from './types';

/**
 * The parser's rejection paths.
 *
 * `parser.ts` has 33 `throw` sites guarding syntax it cannot represent, and before this file
 * none of them were asserted — mutation testing showed that deleting a throw outright, or
 * blanking its message, changed no test result. That is the worst possible gap here: without
 * the guard the parser does not fail, it builds a tree that means something other than the
 * filter the caller wrote, and the query silently returns wrong rows.
 *
 * The property under test is the one the test strategy names: for input the parser cannot
 * represent, it must yield NOT_PARSABLE — never a tree. `toExpression` catches parse errors
 * and converts them, so NOT_PARSABLE is the observable form of every throw below.
 */

const schema = s.define('rejection_target', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
    other: s.string(),
}).compile();

/** Builds a predicate whose source text is exactly `source`. */
const fromSource = (source: string, args = 'r') =>
    new Function(`return (${args}) => ${source};`)() as any;

/** Builds a predicate with a block body. */
const fromBlock = (body: string, args = 'r') =>
    new Function(`return (${args}) => { ${body} };`)() as any;

/**
 * Asserts the parser refused the input.
 *
 * Refusal must be NOT_PARSABLE specifically. A `null`/`undefined` return would also "not be
 * a tree", but callers branch on NOT_PARSABLE to fall back to in-memory evaluation, so the
 * distinction matters.
 */
function expectRejected(fn: any, params?: any) {
    const result = params === undefined
        ? toExpression(schema as any, fn)
        : toExpression(schema as any, fn, params);

    expect(result).toStrictEqual(Expression.NOT_PARSABLE);
}

/** Sanity: the same shape of filter, but supported, must still parse. */
function expectParsed(fn: any, params?: any) {
    const result = params === undefined
        ? toExpression(schema as any, fn)
        : toExpression(schema as any, fn, params);

    expect(result).not.toStrictEqual(Expression.NOT_PARSABLE);
    expect(result).not.toBeNull();
}

describe('literals the parser cannot represent', () => {
    it('parses template literal interpolation as a concat', () => {
        const parsed = toExpression(schema as any, fromSource('r.name === `prefix-${r.other}`')) as { type: string, right?: { call?: string } };

        expect(parsed.type).toBe('comparator');
        expect(parsed.right?.call).toBe('concat');
    });

    it('accepts a template literal without interpolation', () => {
        // The guard must be specific to interpolation, not to backticks.
        expectParsed(fromSource('r.name === `plain`'));
    });

    it('rejects an unterminated string literal', () => {
        // Built as raw source so the unterminated quote reaches the tokenizer.
        expectRejected({ toString: () => '(r) => r.name === "unterminated' });
    });

    it('rejects an expression that ends early', () => {
        expectRejected({ toString: () => '(r) => r.price >' });
    });
});

describe('shapes that are not a schema comparison', () => {
    it('rejects a filter that references no schema property', () => {
        expectRejected(fromSource('1 === 1'));
    });

    it('accepts a comparison with a schema property on both sides', () => {
        // Property-to-property comparison translates directly (e.g. `col_a = col_b`).
        expectParsed(fromSource('r.name === r.other'));
    });

    it('accepts a comparison with a property on exactly one side', () => {
        expectParsed(fromSource('r.name === "x"'));
    });

    it('parses a parenthesised value on the right, which is arithmetic over constants', () => {
        // The type only, never the tree: a PropertyInfo holds its own parent chain, so handing an
        // expression to a matcher makes jest try to serialise a cycle.
        const parsed = toExpression(schema as any, fromSource('r.price === (1 + 2)')) as { type: string };

        expect(parsed.type).toBe('comparator');
    });

    it('accepts bracket access with a literal key', () => {
        // The bracket-access guard is specific to keys the parser cannot resolve statically;
        // a literal key names a schema property just as dot access does.
        expectParsed(fromSource('r["name"] === "x"'));
    });

    it('rejects an unknown property path segment', () => {
        expectRejected(fromSource('r.name.notAProperty === "x"'));
    });
});

describe('unary and negation forms', () => {
    it("accepts '!' applied to a compound expression via De Morgan", () => {
        expectParsed(fromSource('!(r.price > 1 && r.name === "x")'));
    });

    it("rejects '!' applied to a constant", () => {
        expectRejected(fromSource('!true'));
    });

    it("accepts '!' applied to a single property", () => {
        expectParsed(fromSource('!r.active'));
    });

    it("rejects unary '-' on a non-number", () => {
        expectRejected(fromSource('r.name === -"x"'));
    });

    it("accepts unary '-' on a number", () => {
        expectParsed(fromSource('r.price === -5'));
    });
});

describe('transform methods', () => {
    it('rejects a method the parser does not know', () => {
        expectRejected(fromSource('r.name.padStart(3) === "x"'));
    });

    it('rejects property access after a transform method', () => {
        expectRejected(fromSource('r.name.toLowerCase().length === 3'));
    });

    it('rejects comparing a method call to a non-boolean', () => {
        expectRejected(fromSource('r.name.startsWith("a") === "yes"'));
    });

    it('accepts comparing a method call to a boolean', () => {
        expectParsed(fromSource('r.name.startsWith("a") === true'));
    });

    it('rejects a transform method comparing two schema properties', () => {
        expectRejected(fromSource('r.name.startsWith(r.other)'));
    });
});

describe('params paths', () => {
    it('accepts a transform method applied to a params path', () => {
        // Transform methods on a params path are resolved from the param VALUE at parse
        // time, so unlike a method on a schema property they need no runtime support.
        expectParsed(fromSource('p.term.toLowerCase() === r.name', '[r, p]'), { term: 'A' });
    });

    it('accepts a plain params comparison', () => {
        expectParsed(fromSource('r.name === p.term', '[r, p]'), { term: 'A' });
    });

    it('rejects a params path that does not exist', () => {
        expectRejected(fromSource('r.name === p.missing.deeper', '[r, p]'), { term: 'A' });
    });
});

describe('function body shapes', () => {
    it('rejects a block body with no return statement', () => {
        expectRejected(fromBlock('const x = r.price;'));
    });

    it('rejects a block body with more than one statement', () => {
        expectRejected(fromBlock('const x = 1; return r.price > x;'));
    });

    it('accepts a block body that is a single return', () => {
        expectParsed(fromBlock('return r.price > 1;'));
    });
});

describe('rejection never yields a partial tree', () => {
    // The point of the whole file: a refused filter must be refused, not silently narrowed
    // to the fragment the parser did manage to understand. A tree built from half the
    // expression would run as a valid query returning the wrong rows.
    const unsupported = [
        'r.price > 1 && r.name.padStart(3) === "x"',
        'r.name.padStart(3) === "x" || r.price > 1',
        'r.tags.some(t => t === "a") && r.active === true',
        'r.name.padStart(3) === "x" && r.price > 1',
    ];

    it.each(unsupported)('rejects the whole of: %s', source => {
        expectRejected(fromSource(source));
    });
});
