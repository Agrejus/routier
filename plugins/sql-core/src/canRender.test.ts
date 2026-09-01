import { describe, expect, it } from '@jest/globals';
import { CallExpression, ComparatorExpression, PropertyExpression, ValueExpression, toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInSql, getDialect } from './sql';

/**
 * What a plugin asks before pushing a filter down.
 *
 * Answering no is not a failure: the plugin hands the option back and the datastore runs it over the
 * rows the plugin did return. So this has to be right about what the dialect can do, and it has to
 * see a call however deep in the tree it sits.
 */

const schema = s.define('renderable', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
}).compile();

const expressionOf = (filter: (entity: any) => boolean) =>
    toExpression(schema as never, filter as never, undefined as never);

const called = (call: string, inner: any) =>
    new CallExpression({ call: call as never, expression: inner });

describe('canRenderInSql', () => {

    it.each([
        ['a plain comparison', (x: any) => x.age > 1],
        ['a casing call', (x: any) => x.name.toLowerCase() === 'a'],
        ['length', (x: any) => x.name.length > 3],
        ['modulo', (x: any) => x.age % 2 === 0],
        ['arithmetic', (x: any) => x.age * 2 + 1 > 3],
    ])('says yes to %s', (_, filter) => {
        expect(canRenderInSql(expressionOf(filter), 'sqlite')).toBe(true);
    });

    it('says no to a call the dialect does not declare', () => {
        const expression = new ComparatorExpression({
            comparator: 'equals',
            negated: false,
            strict: true,
            left: called('type-of', new PropertyExpression({ property: schema.getProperty('name')! })),
            right: new ValueExpression({ value: 'string' }),
        });

        expect(canRenderInSql(expression, 'sqlite')).toBe(false);
    });

    // The walk has to reach a call nested under another call, or a filter is pushed down on the
    // strength of the outer one alone
    it('sees a call nested inside another call', () => {
        const expression = new ComparatorExpression({
            comparator: 'equals',
            negated: false,
            strict: true,
            left: called('to-lower-case', called('type-of', new PropertyExpression({ property: schema.getProperty('name')! }))),
            right: new ValueExpression({ value: 'x' }),
        });

        expect(canRenderInSql(expression, 'sqlite')).toBe(false);
    });

    it('accepts a dialect object as well as a name', () => {
        expect(canRenderInSql(expressionOf((x: any) => x.age % 2 === 0), getDialect('postgresql'))).toBe(true);
    });
});
