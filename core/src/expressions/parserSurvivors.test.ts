import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '../schema';
import { logger } from '../utilities';
import { toExpression } from './parser';
import { ComparatorExpression, Expression, ValueExpression } from './types';
import { peelCalls } from './utils';

/**
 * Survivors of the 2026-08 mutation audit, killed by direct assertion. Two kinds live here:
 *
 * - **Failure messages** for rejection sites first covered by parserCoverageGaps.test.ts —
 *   the guard was asserted there (NOT_PARSABLE), the wording is asserted here, because the
 *   message is the only diagnostic when a filter silently falls back to in-memory
 *   evaluation.
 * - **Value semantics** no behavioral test observed: string escapes, keyword literals,
 *   type converters on bound params, boolean folding of method calls, the truthy
 *   shorthand.
 */

const schema = s.define('parser_survivors', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
    when: s.date(),
    tags: s.array(s.string()),
    other: s.string(),
}).compile();

const fromSource = (source: string, args = 'r') =>
    new Function(`return (${args}) => ${source};`)() as any;

const fromBlock = (body: string, args = 'r') =>
    new Function(`return (${args}) => { ${body} };`)() as any;

const withSource = (source: string) => {
    const fn: any = () => true;
    fn.toString = () => source;
    return fn;
};

let warn: any;

beforeEach(() => {
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
});

function failureMessage(fn: any, params?: any): string {
    warn.mockClear();

    if (params === undefined) {
        toExpression(schema as any, fn);
    } else {
        toExpression(schema as any, fn, params);
    }

    expect(warn).toHaveBeenCalled();
    const [, context] = warn.mock.calls[warn.mock.calls.length - 1] as [string, any];

    return String(context?.error?.message ?? '');
}

function parsed(fn: any, params?: any): ComparatorExpression {
    const result = params === undefined
        ? toExpression(schema as any, fn)
        : toExpression(schema as any, fn, params);

    expect(result).not.toStrictEqual(Expression.NOT_PARSABLE);
    return result as ComparatorExpression;
}

describe('failure messages name their cause', () => {
    it('an unknown character', () => {
        expect(failureMessage(fromSource('r.price === ~1'))).toMatch(/unexpected character '~'/);
    });

    it('source ending mid-expression', () => {
        expect(failureMessage(withSource('(r) => r.price ==='))).toMatch(/unexpected end of expression/);
    });

    it('the punctuation an unclosed parenthesis is missing', () => {
        expect(failureMessage(withSource('(r) => (r.price === 1'))).toMatch(/expected '\)'/);
    });

    it('a trailing token after a complete expression', () => {
        expect(failureMessage(withSource('(r) => r.name === "a" r'))).toMatch(/unexpected token 'r'/);
    });

    it('comparison against a parenthesized expression', () => {
        expect(failureMessage(fromSource('(r.price === 1) === true'))).toMatch(/comparison against a parenthesized expression/);
    });

    it("unary '-' on a non-number", () => {
        expect(failureMessage(fromSource('r.price === -"x"'))).toMatch(/unary '-' on a non-number/);
    });

    it('the token an operand could not be built from', () => {
        expect(failureMessage(withSource('(r) => r.name === ?'))).toMatch(/Unsupported expression format: \?/);
    });

    it('a non-identifier path segment', () => {
        expect(failureMessage(withSource('(r) => r.name.123 === "x"'))).toMatch(/'\.123'/);
    });

    it('a nested method call and the method it sits inside', () => {
        expect(failureMessage(fromSource('r.name.startsWith(r.other.endsWith("x"))'))).toMatch(/nested method call inside \.startsWith\(\)/);
    });

    it('a param path that resolves to a missing member', () => {
        const message = failureMessage(fromSource('r.name === p.missing.deep', '[r, p]'), { present: 1 });

        expect(message).toMatch(/Cannot find path in params for \.where\(\)/);
        expect(message).toMatch(/Path: p\.missing/);
    });

    it('bare `params` used as an operand', () => {
        expect(failureMessage(fromSource('r.name === p', '[r, p]'), 'a-value')).toMatch(/Make sure parameters are not used inline/);
    });

    it('a bracket segment whose param value is not a string', () => {
        expect(failureMessage(fromSource('r[p.k] === "x"', '[r, p]'), { k: 42 })).toMatch(/could not find PropertyInfo for path: k/);
    });

    it('a method call on the right side of a comparison', () => {
        expect(failureMessage(fromSource('r.active === r.other.startsWith("x")'))).toMatch(/method call on the right side of a comparison/);
    });

    it('a method comparing two schema properties, naming the method', () => {
        expect(failureMessage(fromSource('r.name.startsWith(r.other)'))).toMatch(/\.startsWith\(\) comparing two schema properties/);
    });

    it('a transform method on a params path used with .includes()', () => {
        expect(failureMessage(fromSource('p.list.toLowerCase().includes(r.name)', '[r, p]'), { list: 'abc' })).toMatch(/transform method on a collection used with \.includes\(\)/);
    });

    it('a non-includes method on a params path, naming the method', () => {
        expect(failureMessage(fromSource('p.v.startsWith(r.name)', '[r, p]'), { v: 'abc' })).toMatch(/\.startsWith\(\) on a non-property target/);
    });

    it('a transform method outside string matching', () => {
        expect(failureMessage(fromSource('r.name.toLowerCase() === "x"'))).toMatch(/transform method outside of startsWith\/endsWith\/includes/);
    });

    it('comparing a method call to a non-boolean', () => {
        expect(failureMessage(fromSource('r.name.startsWith("x") === 1'))).toMatch(/comparing a method call to a non-boolean/);
    });

    it('a callable that is neither an arrow nor a function expression', () => {
        expect(failureMessage(withSource('not a function at all'))).toBe('Invalid Function');
    });

    it('an arrow function with no entity parameter', () => {
        expect(failureMessage(withSource('() => true'))).toBe('Invalid Function');
    });

    it('a block body without a single return statement', () => {
        expect(failureMessage(fromBlock('const x = r.name; return x === "a"'))).toMatch(/block body without a single return statement/);
    });
});

describe('string escapes reach the value', () => {
    it.each([
        ['n', '\n'],
        ['r', '\r'],
        ['t', '\t'],
        ['b', '\b'],
        ['f', '\f'],
        ['v', '\v'],
        ['0', '\0'],
    ])('\\%s decodes inside a string literal', (escape, decoded) => {
        // The filter SOURCE must contain backslash + letter, exactly as a developer would
        // type "a\nb" — Function.prototype.toString preserves the escape verbatim, and the
        // parser's own tokenizer is what decodes it.
        const cmp = parsed(fromSource(`r.name === "a\\${escape}b"`));

        expect((cmp.right as ValueExpression).value).toBe(`a${decoded}b`);
    });
});

describe('keyword literals', () => {
    it('null parses as the value null', () => {
        const cmp = parsed(fromSource('r.name === null'));
        expect((cmp.right as ValueExpression).value).toBeNull();
    });

    it('undefined parses as the value undefined', () => {
        const cmp = parsed(fromSource('r.name === undefined'));
        expect((cmp.right as ValueExpression).value).toBeUndefined();
    });

    it('true and false parse as booleans', () => {
        expect((parsed(fromSource('r.active === true')).right as ValueExpression).value).toBe(true);
        expect((parsed(fromSource('r.active === false')).right as ValueExpression).value).toBe(false);
    });
});

describe('converters on bound params', () => {
    it('a Date param passes through unchanged', () => {
        const date = new Date('2026-01-02T00:00:00Z');
        const cmp = parsed(fromSource('r.when === p.d', '[r, p]'), { d: date });

        expect((cmp.right as ValueExpression).value).toBe(date);
    });

    it('an Array param passes through unchanged', () => {
        const tags = ['a', 'b'];
        const cmp = parsed(fromSource('r.tags === p.t', '[r, p]'), { t: tags });

        expect((cmp.right as ValueExpression).value).toBe(tags);
    });

    it('a String-typed param is coerced to string, with null passed through', () => {
        expect((parsed(fromSource('r.name === p.v', '[r, p]'), { v: 123 }).right as ValueExpression).value).toBe('123');
        expect((parsed(fromSource('r.name === p.v', '[r, p]'), { v: null }).right as ValueExpression).value).toBeNull();
    });
});

describe('method-call comparison folding', () => {
    it('=== false negates the comparator', () => {
        const cmp = parsed(fromSource('r.name.startsWith("x") === false'));

        expect(cmp.comparator).toBe('starts-with');
        expect(cmp.negated).toBe(true);
    });

    it('=== true keeps it positive', () => {
        const cmp = parsed(fromSource('r.name.startsWith("x") === true'));

        expect(cmp.comparator).toBe('starts-with');
        expect(cmp.negated).toBe(false);
    });

    it('!== false is also positive', () => {
        const cmp = parsed(fromSource('r.name.startsWith("x") !== false'));

        expect(cmp.negated).toBe(false);
    });

    it('a bare method call is a positive comparator with strict off', () => {
        const cmp = parsed(fromSource('r.name.startsWith("x")'));

        expect(cmp.comparator).toBe('starts-with');
        expect(cmp.negated).toBe(false);
        expect(cmp.strict).toBe(false);
    });
});

describe('truthy shorthand', () => {
    it('a bare property compares equal to true', () => {
        const cmp = parsed(fromSource('r.active'));

        expect(cmp.comparator).toBe('equals');
        expect((cmp.right as ValueExpression).value).toBe(true);
    });
});

describe('value transformers', () => {
    it('a transform on a literal value is carried on the value expression', () => {
        const cmp = parsed(fromSource('r.name.startsWith("X".toLowerCase())'));

        expect(peelCalls(cmp.right)?.calls.length).toBeGreaterThan(0);
    });
});

describe('block bodies', () => {
    it('a single-return block with a trailing semicolon parses like an expression body', () => {
        const cmp = parsed(fromBlock('return r.name === "x";'));

        expect(cmp.comparator).toBe('equals');
        expect((cmp.right as ValueExpression).value).toBe('x');
    });
});

describe('remaining uncovered paths', () => {
    it('names exhaustion when a token is consumed past the end', () => {
        expect(failureMessage(withSource('(r) => r.price === -'))).toMatch(/unexpected end of expression/);
    });

    it('names the schema-property requirement for a lone value condition', () => {
        expect(failureMessage(withSource('(r) => 1'))).toMatch(/a filter condition must reference a schema property/);
    });

    it('names an out-of-scope variable and asks for parameters', () => {
        expect(failureMessage(fromSource('r.name === someVariable'))).toMatch(/Cannot derive value from variable/);
    });

    it('binds a params array for membership .includes() without a paired property', () => {
        const list = ['a', 'b'];
        const cmp = parsed(fromSource('p.list.includes(r.name)', '[r, p]'), { list });

        expect(cmp.comparator).toBe('includes');
        // The param has no paired schema property, so its value passes through untouched.
        expect((cmp.left as ValueExpression).value).toBe(list);
    });
});
