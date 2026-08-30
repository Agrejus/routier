import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { toExpression } from './parser';
import { ComparatorExpression, Expression, ValueExpression } from './types';

/**
 * Parser paths the 2026-08 mutation run reported as NO COVERAGE — code no test in the
 * mutation set reached at all. Each block below drives one of those paths through
 * `toExpression`, the parser's real entry point, so the guard (or behavior) is observable
 * rather than merely present.
 */

const schema = s.define('coverage_target', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    other: s.string(),
}).compile();

const serializedSchema = s.define('coverage_serialized', {
    id: s.string().key(),
    enc: s.string().serialize(v => `enc:${v}`).deserialize(v => String(v).slice(4)),
}).compile();

const fromSource = (source: string, args = 'r') =>
    new Function(`return (${args}) => ${source};`)() as any;

/** A callable whose SOURCE is under our control — how truncated/invalid source reaches
 * the tokenizer, since the Function constructor would reject it as real code. */
const withSource = (source: string) => {
    const fn: any = () => true;
    fn.toString = () => source;
    return fn;
};

function expectRejected(fn: any, params?: any, target: any = schema) {
    const result = params === undefined
        ? toExpression(target as any, fn)
        : toExpression(target as any, fn, params);

    expect(result).toHaveProperty('type', 'not-parsable');
}

function expectParsed(fn: any, params?: any, target: any = schema) {
    const result = params === undefined
        ? toExpression(target as any, fn)
        : toExpression(target as any, fn, params);

    expect(result).not.toHaveProperty('type', 'not-parsable');
}

describe('tokenizer guards', () => {
    it('rejects a character outside the token tables', () => {
        // `@` is not valid JavaScript in an expression either, so the tokenizer is the only guard
        expectRejected(withSource('(r) => r.price === @1'));
    });

    it('rejects source that ends mid-expression', () => {
        expectRejected(withSource('(r) => r.price ==='));
    });

    it('rejects an unclosed parenthesis', () => {
        expectRejected(withSource('(r) => (r.price === 1'));
    });

    it('accepts a classic function expression', () => {
        // What ES5-targeting transpilers rewrite every arrow filter into.
        // eslint-disable-next-line prefer-arrow-callback
        expectParsed(function classic(r: any) { return r.name === 'a'; });
    });

    it('rejects a callable whose source is neither an arrow nor a function', () => {
        expectRejected(withSource('nonsense source'));
    });
});

describe('rejection guards', () => {
    // A boolean group compared to a boolean is still not a value the grammar reads
    it('rejects a comparison against a parenthesized boolean', () => {
        expectRejected(fromSource('(r.price === 1) === true'));
    });

    it.todo('r.name.toLowerCase().length === 3 — a call chained onto a call');

    it('rejects a nested method call inside a method argument', () => {
        expectRejected(fromSource('r.name.startsWith(r.other.toLowerCase())'));
    });

    it('rejects a condition that references no schema property', () => {
        expectRejected(fromSource('1 === 4'));
    });

    it('rejects bare `params` as a comparison operand', () => {
        expectRejected(fromSource('r.name === p', '[r, p]'), 'a-value');
    });

    it('rejects a transform method on a params path used with .includes()', () => {
        expectRejected(fromSource('p.list.toLowerCase().includes(r.name)', '[r, p]'), { list: 'abc' });
    });

    it('rejects a non-includes method on a params path', () => {
        expectRejected(fromSource('p.v.startsWith(r.name)', '[r, p]'), { v: 'abc' });
    });
});

describe('value resolution', () => {
    it('parses `void 0` as the value undefined', () => {
        const result = toExpression(schema as any, fromSource('r.name === void 0'));

        expect(result).not.toHaveProperty('type', 'not-parsable');
        const cmp = result as ComparatorExpression;
        expect((cmp.right as ValueExpression).value).toBeUndefined();
    });

    it('runs a bound param through the paired property\'s serializer', () => {
        // The bound value must match what the COLUMN holds, and the column holds the
        // serialized form. The raw param travels as JSON (parseUnknown), so the
        // app-side value is JSON-encoded here the way the wire produces it.
        const result = toExpression(serializedSchema as any, fromSource('r.enc === p.v', '[r, p]'), { v: JSON.stringify('x') });

        expect(result).not.toHaveProperty('type', 'not-parsable');
        const cmp = result as ComparatorExpression;
        expect((cmp.right as ValueExpression).value).toBe('enc:x');
    });

    it('refuses a serializer-paired param that is not JSON', () => {
        // The complement of the case above: a raw value the serializer pipeline cannot
        // decode must refuse rather than bind something wrong.
        expectRejected(fromSource('r.enc === p.v', '[r, p]'), { v: 'not json' }, serializedSchema);
    });

    it('re-binds params on a cached template', () => {
        // The second parse of identical source reuses the cached template; the new params
        // must be resolved into it rather than the first call's values leaking through.
        const filter = fromSource('r.name === p.v', '[r, p]');

        const first = toExpression(schema as any, filter, { v: 'first' }) as ComparatorExpression;
        const second = toExpression(schema as any, filter, { v: 'second' }) as ComparatorExpression;

        expect((first.right as ValueExpression).value).toBe('first');
        expect((second.right as ValueExpression).value).toBe('second');
    });
});

describe('template cache', () => {
    it('keeps parsing correctly past the per-schema cache cap', () => {
        const cacheSchema = s.define('coverage_cache', {
            id: s.string().key(),
            price: s.number(),
        }).compile();

        // The cap (1024) guards against unbounded dynamic filter generation; crossing it
        // clears the cache, and parsing must keep working on both sides of that line.
        for (let i = 0; i <= 1025; i++) {
            const result = toExpression(cacheSchema as any, fromSource(`r.price === ${i}`)) as ComparatorExpression;
            expect((result.right as ValueExpression).value).toBe(i);
        }
    });
});
