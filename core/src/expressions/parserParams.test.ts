import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { toExpression } from './parser';
import { ComparatorExpression, Expression } from './types';
import { peelCalls } from './utils';

/**
 * Param-driven property access and value transformers.
 *
 * Targets two surviving clusters:
 *   parser.ts:621 — `entity[p.field]`, where the property being filtered is chosen by a
 *                   param VALUE rather than written in the source (10 mutants)
 *   parser.ts:666 — the transform-method table, whose four entries differ only in the
 *                   transformer and locale they attach (7 mutants)
 *
 * Both are asserted against the parsed tree rather than through a query: a filter that fails
 * to parse falls back to in-memory evaluation and returns correct rows regardless, so
 * behavior cannot distinguish a working parse from a rescued one.
 */

const schema = s.define('parser_params', {
    id: s.string().key(),
    name: s.string(),
    other: s.string(),
    price: s.number(),
}).compile();

const build = (source: string, args: string) =>
    new Function(`return (${args}) => ${source};`)() as any;

const parse = (source: string, params: any, args = '[r, p]') =>
    toExpression(schema as any, build(source, args), params);

const comparator = (source: string, params: any) => {
    const result = parse(source, params);
    expect(result).not.toHaveProperty('type', 'not-parsable');
    expect(result).toBeInstanceOf(ComparatorExpression);
    return result as ComparatorExpression;
};

/** The schema property the comparison filters on. */
const filteredProperty = (source: string, params: any) =>
    (peelCalls(comparator(source, params).left)?.operand as any)?.property?.name;

/** The call applied to the compared value, and the locale it carries as its argument. */
const valueTransform = (source: string, params: any) => {
    const right = comparator(source, params).right as any;
    const calls = peelCalls(right)?.calls ?? [];

    return { transformer: calls[0]?.call ?? null, locale: right?.arguments?.[0]?.value ?? null };
};

describe('param-driven property access', () => {
    it('resolves the filtered property from a param value', () => {
        // The source never names `name`; the param supplies it. Getting this wrong filters
        // the wrong column while looking perfectly valid.
        expect(filteredProperty('r[p.field] === "x"', { field: 'name' })).toBe('name');
    });

    it('resolves a different property from a different param value', () => {
        expect(filteredProperty('r[p.field] === "x"', { field: 'other' })).toBe('other');
    });

    it('produces different trees for different param values', () => {
        // The template depends on the param VALUE, so it cannot be cached and reused across
        // calls. If it were, the second call would filter the first call's column.
        const first = filteredProperty('r[p.field] === "x"', { field: 'name' });
        const second = filteredProperty('r[p.field] === "x"', { field: 'other' });

        expect(first).toBe('name');
        expect(second).toBe('other');
    });

    it('resolves a nested param path', () => {
        expect(filteredProperty('r[p.cfg.field] === "x"', { cfg: { field: 'name' } })).toBe('name');
    });

    it('resolves a param path written with optional chaining', () => {
        expect(filteredProperty('r[p?.field] === "x"', { field: 'name' })).toBe('name');
    });

    it('rejects a param path that resolves to a non-string', () => {
        // The resolved value names a column, so anything but a string cannot be used.
        expect(parse('r[p.field] === "x"', { field: 42 })).toHaveProperty('type', 'not-parsable');
    });

    it('rejects a param path that resolves to undefined', () => {
        expect(parse('r[p.field] === "x"', { other: 'name' })).toHaveProperty('type', 'not-parsable');
    });

    it('rejects a param path resolving to an object', () => {
        expect(parse('r[p.field] === "x"', { field: { nested: true } })).toHaveProperty('type', 'not-parsable');
    });

    it('rejects bracket access by a bare identifier that is not the params name', () => {
        // `r[someVar]` cannot be resolved statically and is not a param path.
        expect(parse('r[unknownVar] === "x"', { field: 'name' })).toHaveProperty('type', 'not-parsable');
    });

    it('still accepts bracket access with a string literal', () => {
        expect(filteredProperty('r["name"] === "x"', {})).toBe('name');
    });
});

describe('value transform methods', () => {
    /** The property side, because a call over a bound param folds to a value. */
    const transformFor = (method: string) => {
        const calls = peelCalls(comparator(`r.name.${method}() === p.term`, { term: 'Value' }).left)?.calls ?? [];

        return { transformer: calls[0]?.call ?? null, locale: (calls[0]?.arguments?.[0] as any)?.value ?? null };
    };

    it('attaches a lower-case transformer for toLowerCase', () => {
        expect(transformFor('toLowerCase').transformer).toBe('to-lower-case');
    });

    it('attaches an upper-case transformer for toUpperCase', () => {
        expect(transformFor('toUpperCase').transformer).toBe('to-upper-case');
    });

    it('attaches a lower-case transformer for toLocaleLowerCase', () => {
        expect(transformFor('toLocaleLowerCase').transformer).toBe('to-lower-case');
    });

    it('attaches an upper-case transformer for toLocaleUpperCase', () => {
        expect(transformFor('toLocaleUpperCase').transformer).toBe('to-upper-case');
    });

    // The locale is the only thing separating the plain and locale-aware variants. Without
    // these two the pairs are indistinguishable and half the table can be blanked freely.
    it('sets no locale for the non-locale variants', () => {
        expect(transformFor('toLowerCase').locale).toBeNull();
        expect(transformFor('toUpperCase').locale).toBeNull();
    });

    it('sets a locale for the locale-aware variants', () => {
        expect(transformFor('toLocaleLowerCase').locale).toBe('en-US');
        expect(transformFor('toLocaleUpperCase').locale).toBe('en-US');
    });

    it('leaves an untransformed value without a transformer', () => {
        expect(valueTransform('r.name === p.term', { term: 'Value' }).transformer).toBeNull();
    });

    it('computes the transform into the bound value rather than carrying it', () => {
        const right = comparator('r.name === p.term.toUpperCase()', { term: 'Value' }).right as any;

        expect(peelCalls(right)?.calls).toEqual([]);
        expect(right.value).toBe('VALUE');
    });

    it('rejects a method that is not in the transform table', () => {
        expect(parse('r.name === p.term.trim()', { term: ' x ' })).toHaveProperty('type', 'not-parsable');
    });
});
