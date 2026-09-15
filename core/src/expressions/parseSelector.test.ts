import { describe, expect, it } from '@jest/globals';
import { s } from '../schema';
import { parseSelector, SelectedValue, toExpression } from './parser';
import { Expression } from './types';

/**
 * `parseSelector` reads a sort, map, group or `nearest` selector with the filter grammar, for the
 * properties its value is read from and whether the value is one of them.
 *
 * A plugin decides from this whether it can run the option: one that orders by column cannot run
 * `r => r.name.length`, and one that runs the selector over stored rows cannot run it over a renamed
 * property. So the cases below are about what is read, not about evaluating anything.
 */

const schema = s.define('selectors', {
    id: s.string().key(),
    name: s.string(),
    first: s.string(),
    last: s.string().from('last_name'),
    price: s.number(),
    createdDate: s.date(),
    dueDate: s.date().from('due'),
    window: s.object({ opens: s.date() }),
    tags: s.array(s.string()),
}).compile();

const valueOf = (selector: (row: any) => unknown): SelectedValue => {
    const parsed = parseSelector(schema, selector);

    if (parsed.kind !== 'value') {
        throw new Error(`Expected one value, parsed ${parsed.kind}`);
    }

    return parsed.value;
};

const names = (value: SelectedValue) => value.reads.map(property => property.id);

describe('parseSelector', () => {

    describe('a selector that is a property', () => {
        it('reads a root property', () => {
            const value = valueOf(r => r.name);

            expect(value.isDirectProperty).toBe(true);
            expect(value.property?.id).toBe('name');
            expect(names(value)).toEqual(['name']);
        });

        it('reads a nested property through the schema', () => {
            const value = valueOf(r => r.window.opens);

            expect(value.isDirectProperty).toBe(true);
            expect(value.property?.id).toBe('window.opens');
        });

        it('reads a renamed property as the property, not its stored name', () => {
            const value = valueOf(r => r.dueDate);

            expect(value.isDirectProperty).toBe(true);
            expect(value.property?.hasRenamedSegments).toBe(true);
        });

        it('reads bracket access, a destructured parameter and a function expression', () => {
            expect(valueOf(r => r['price']).property?.id).toBe('price');
            expect(valueOf(({ name }) => name).isDirectProperty).toBe(true);
            // What an ES5 transpiler makes of an arrow function
            expect(valueOf(function (r) { return r.name; }).property?.id).toBe('name');
        });
    });

    describe('a selector that computes a value', () => {
        it.each([
            ['a string length', (r: any) => r.name.length, 'name'],
            ['a casing call', (r: any) => r.name.toUpperCase(), 'name'],
            ['arithmetic', (r: any) => r.price * 2, 'price'],
            ['arithmetic on the left', (r: any) => 100 - r.price, 'price'],
            ['a date method the filter grammar has no node for', (r: any) => r.createdDate.getTime(), 'createdDate'],
            ['a local-time date method a filter refuses', (r: any) => r.createdDate.getFullYear(), 'createdDate'],
            ['a call on a renamed date', (r: any) => r.dueDate.getTime(), 'dueDate'],
            ['a call on a nested date', (r: any) => r.window.opens.getTime(), 'window.opens'],
            ['a chain of calls', (r: any) => r.name.trim().toLowerCase().length, 'name'],
            ['a member of a computed value', (r: any) => r.createdDate.toISOString().length, 'createdDate'],
        ])('reads the property behind %s', (_, selector, property) => {
            const value = valueOf(selector);

            expect(value.isDirectProperty).toBe(false);
            expect(value.property?.id).toBe(property);
            expect(names(value)).toEqual([property]);
        });

        it('reads every property a value is computed from, and names none of them the property', () => {
            const value = valueOf(r => r.first + ' ' + r.last);

            expect(value.isDirectProperty).toBe(false);
            expect(value.property).toBeNull();
            expect(names(value).sort()).toEqual(['first', 'last']);
        });

        it('reads the properties an argument of an unknown call reads', () => {
            expect(names(valueOf(r => r.first.localeCompare(r.last))).sort()).toEqual(['first', 'last']);
        });

        it('reads a conditional', () => {
            const value = valueOf(r => r.price > 10 ? r.first : r.last);

            expect(value.isDirectProperty).toBe(false);
            expect(names(value).sort()).toEqual(['first', 'last', 'price']);
        });
    });

    describe('an object literal', () => {
        it('reads each field on its own', () => {
            const parsed = parseSelector(schema, r => ({ label: r.name, double: r.price * 2, year: r.dueDate.getFullYear() }));

            expect(parsed.kind).toBe('object');

            const fields = parsed.kind === 'object' ? parsed.fields : [];

            expect(fields.map(field => [field.name, field.property?.id, field.isDirectProperty])).toEqual([
                ['label', 'name', true],
                ['double', 'price', false],
                ['year', 'dueDate', false],
            ]);
        });

        it('reads a shorthand field through the parameter it names', () => {
            const parsed = parseSelector(schema, ({ name, price }) => ({ name, price }));

            expect(parsed.kind === 'object' && parsed.fields.map(field => [field.name, field.property?.id, field.isDirectProperty])).toEqual([
                ['name', 'name', true],
                ['price', 'price', true],
            ]);
        });

        it('reads an object returned from a block body', () => {
            const parsed = parseSelector(schema, function (r) { return { label: r.name }; });

            expect(parsed.kind === 'object' && parsed.fields[0].property?.id).toBe('name');
        });
    });

    describe('what it does not read', () => {
        it.each([
            ['a closure', (r: any) => String(r.name)],
            ['a callback argument', (r: any) => r.tags.map((t: string) => t.length)],
            ['a spread', (r: any) => ({ ...r })],
            ['a block that does more than return', (r: any) => { const n = r.name; return n; }],
            ['a property the schema does not declare', (r: any) => r.missing],
            ['the row itself', (r: any) => r],
        ])('refuses %s, for the caller to run as before', (_, selector) => {
            expect(parseSelector(schema, selector).kind).toBe('not-parsable');
        });
    });

    it('caches by function source per schema', () => {
        const selector = (r: any) => r.price * 3;

        expect(parseSelector(schema, selector)).toBe(parseSelector(schema, selector));
    });

    it('leaves the filter grammar as it was: a call with no node is still not parsable in a filter', () => {
        expect(Expression.isNotParsable(toExpression(schema, (r: any) => r.createdDate.getFullYear() > 2020))).toBe(true);
        expect(Expression.isNotParsable(toExpression(schema, (r: any) => r.name.localeCompare('a') === 0))).toBe(true);
    });
});
