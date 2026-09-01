import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInMql, toMql } from './mql';

/** The Mongo half of the constant-operand fold. Predicate list shared with sql-core. */

const schema = s.define('constant_operands', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
}).compile();

const treeFor = (source: string, params?: unknown) =>
    toExpression(schema as never, new Function(`return ${source};`)() as never, params as never);

describe('a constant on the called side reaches MQL as a value', () => {

    it.each([
        ['an exponent', '(x) => (2 ** 3) === x.age', { age: { $eq: 8 } }],
        ['a bitwise and', '(x) => (6 & 4) === x.age', { age: { $eq: 4 } }],
        ['coalescing', '(x) => (null ?? "z") === x.name', { name: { $eq: 'z' } }],
        ['casing', '(x) => "ADA".toLowerCase() === x.name', { name: { $eq: 'ada' } }],
    ])('embeds %s as its result', (_, source, expected) => {
        const tree = treeFor(source);

        expect(canRenderInMql(tree)).toBe(true);
        expect(toMql(tree)).toEqual(expected);
    });

    it('embeds an interpolated template as one value', () => {
        const tree = treeFor('([x, p]) => x.name === `${p.prefix}a`', { prefix: 'z' });

        expect(canRenderInMql(tree)).toBe(true);
        expect(toMql(tree)).toEqual({ name: { $eq: 'za' } });
    });

    it('declines a constant that could not be computed, rather than throwing on it', () => {
        expect(canRenderInMql(treeFor('(x) => ("abc" * 2) === x.age'))).toBe(false);
    });

    it('still renders a call on a property, which only the engine can compute', () => {
        expect(toMql(treeFor('(x) => x.name.toLowerCase() === "ada"')))
            .toEqual({ $expr: { $eq: [{ $toLower: '$name' }, { $literal: 'ada' }] } });
    });
});
