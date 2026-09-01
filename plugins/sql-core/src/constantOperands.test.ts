import { describe, expect, it } from '@jest/globals';
import { CallExpression, ComparatorExpression, PropertyExpression, toExpression, ValueExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInSql, toSql } from './sql';

const schema = s.define('constant_operands', {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
    a: s.number(),
    b: s.number(),
}).compile();

const treeFor = (source: string, params?: unknown) =>
    toExpression(schema as never, new Function(`return ${source};`)() as never, params as never);

type Dialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

describe('a constant on the called side reaches SQL as a parameter', () => {

    it.each([
        ['an exponent', '(x) => (2 ** 3) === x.age', 'postgresql', 8],
        ['a bitwise and', '(x) => (6 & 4) === x.age', 'postgresql', 4],
        ['a shift', '(x) => (1 << 3) === x.age', 'mysql', 8],
        ['coalescing', '(x) => (null ?? "z") === x.name', 'sqlite', 'z'],
        ['casing', '(x) => "ADA".toLowerCase() === x.name', 'sqlite', 'ada'],
    ])('binds %s as its result', (_, source, dialect, expected) => {
        const tree = treeFor(source);

        expect(canRenderInSql(tree, dialect as Dialect)).toBe(true);
        expect(toSql(tree, dialect as Dialect).params).toEqual([expected]);
    });

    it('binds an interpolated template as one parameter', () => {
        const tree = treeFor('([x, p]) => x.name === `${p.prefix}a`', { prefix: 'z' });

        expect(canRenderInSql(tree, 'sqlite')).toBe(true);

        const result = toSql(tree, 'sqlite');

        expect(result.where).toBe('"name" = ?');
        expect(result.params).toEqual(['za']);
    });

    /**
     * Rendering it would throw, and a thrown translation is a failed query. Declining sends it to the
     * caller's own predicate, which answers correctly.
     */
    it('declines a constant that could not be computed, rather than throwing on it', () => {
        const tree = treeFor('(x) => ("abc" * 2) === x.age');

        for (const dialect of ['sqlite', 'postgresql', 'mysql', 'mssql'] as const) {
            expect(canRenderInSql(tree, dialect)).toBe(false);
        }
    });

    it('still renders a call on a property, which only the engine can compute', () => {
        const tree = treeFor('(x) => x.name.toLowerCase() === "ada"');

        expect(canRenderInSql(tree, 'sqlite')).toBe(true);
        expect(toSql(tree, 'sqlite').where).toBe('LOWER("name") = ?');
    });
});

describe('an unfolded call on a literal', () => {

    it('computes the call rather than binding the raw literal', () => {
        // A tree that skipped the fold, which only a direct toSql caller can produce.
        const tree = new ComparatorExpression({
            comparator: 'equals', negated: false, strict: true,
            left: new PropertyExpression({
                property: schema.properties.find(p => p.getAssignmentPath() === 'name')!
            }),
            right: new CallExpression({
                call: 'to-lower-case',
                expression: new ValueExpression({ value: 'ABC' }),
                arguments: []
            }),
        });

        expect(toSql(tree as never, 'sqlite').params).toEqual(['abc']);
    });

    it('throws when the call cannot be computed on the literal', () => {
        const tree = new ComparatorExpression({
            comparator: 'equals', negated: false, strict: true,
            left: new PropertyExpression({
                property: schema.properties.find(p => p.getAssignmentPath() === 'age')!
            }),
            right: new CallExpression({
                call: 'floor',
                expression: new ValueExpression({ value: 'abc' }),
                arguments: []
            }),
        });

        expect(() => toSql(tree as never, 'sqlite')).toThrow(/cannot be computed/);
    });
});

describe('a comparison between two computed columns', () => {

    // Each placeholder gets exactly one parameter: a side rendered twice binds twice and the
    // values shift, so `a + 1 = b + 2` silently becomes `a + 1 = b + 1`.
    it.each([
        ['equals', '(x) => (x.a + 1) === (x.b + 2)', [1, 2]],
        ['not equals', '(x) => (x.a + 1) !== (x.b + 2)', [1, 2]],
        // The value is emitted BEFORE the column here, so it has to be bound first.
        ['equals with the value on the left', '(x) => 5 === x.a + 1', [5, 1]],
        ['not equals with the value on the left', '(x) => 5 !== x.a + 1', [5, 1]],
        ['not equals against a bitwise column', '(x) => 0 !== (x.a & 2)', [0, 2]],
    ])('binds parameters in emission order on %s', (_, source, expected) => {
        const { where, params } = toSql(treeFor(source) as never, 'sqlite');

        expect(params).toEqual(expected);
        expect(where.split('?')).toHaveLength(params.length + 1);
    });
});
