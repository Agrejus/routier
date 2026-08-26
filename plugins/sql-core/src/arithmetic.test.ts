import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { toSql } from './sql';

/** The SQL half of arithmetic. Predicate list shared with core and mongodb. */

const schema = s.define('arithmetic', {
    id: s.string().key(),
    age: s.number(),
    price: s.number(),
    other: s.number(),
}).compile();

const sql = (filter: (entity: any) => boolean, dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' = 'sqlite') =>
    toSql(toExpression(schema as never, filter as never, undefined as never), dialect);

describe('arithmetic operators', () => {

    it.each([
        ['addition', (x: any) => x.age + 1 > 3, '("age" + ?) > ?', [1, 3]],
        ['subtraction', (x: any) => x.age - 1 === 4, '("age" - ?) = ?', [1, 4]],
        ['multiplication', (x: any) => x.price * 1.2 > 100, '("price" * ?) > ?', [1.2, 100]],
        ['division', (x: any) => x.price / 2 === 5, '("price" / ?) = ?', [2, 5]],
    ])('renders %s with the operand bound, not inlined', (_, filter, where, params) => {
        const rendered = sql(filter);

        expect(rendered.where).toBe(where);
        expect(rendered.params).toEqual(params);
    });

    /**
     * SQLite's `%` truncates both operands to integers, so it is built from `a - b * trunc(a / b)`.
     * The divisor is bound twice because the expression names it twice — a placeholder is positional,
     * so reusing the text without rebinding would shift every parameter after it.
     */
    it('renders modulo as JavaScript remainder, not SQLite integer remainder', () => {
        const rendered = sql((x: any) => x.age % 2 === 0);

        expect(rendered.where).toBe('("age" - ? * CAST("age" / ? AS INTEGER)) = ?');
        expect(rendered.params).toEqual([2, 2, 0]);
    });

    it('rebinds the parameters inside the left operand when it is rendered twice', () => {
        const rendered = sql((x: any) => x.age * 2 % 3 === 0);

        expect(rendered.params).toEqual([2, 3, 2, 3, 0]);
    });

    it('renders two properties as two columns, binding nothing', () => {
        const rendered = sql((x: any) => x.age + x.other === 7);

        expect(rendered.where).toBe('("age" + "other") = ?');
        expect(rendered.params).toEqual([7]);
    });

    /** Parenthesised so the engine's own precedence cannot reassociate what the caller wrote. */
    it('parenthesises a property-bearing operand rather than trusting engine precedence', () => {
        const rendered = sql((x: any) => x.age + x.other * 2 === 14);

        expect(rendered.where).toBe('("age" + ("other" * ?)) = ?');
        expect(rendered.params).toEqual([2, 14]);
    });

    // 3 * 4 has no column in it, so the database is never asked to compute it
    it('folds arithmetic over literals instead of binding both operands', () => {
        const rendered = sql((x: any) => x.age + 3 * 4 === 14);

        expect(rendered.where).toBe('("age" + ?) = ?');
        expect(rendered.params).toEqual([12, 14]);
    });

    it('keeps parameters in the order the text reads', () => {
        expect(sql((x: any) => x.price * 2 > x.other + 1).params).toEqual([2, 1]);
    });

    it.each([
        // Each engine needs a different remainder: PostgreSQL has no `%` for double precision,
        // MSSQL's rejects float, and SQLite's truncates to integer
        ['sqlite', '("age" - ? * CAST("age" / ? AS INTEGER)) = ?'],
        ['postgresql', 'MOD(("age")::numeric, ($1)::numeric) = $2'],
        ['mysql', '(`age` % ?) = ?'],
        ['mssql', '(([age]) % CAST(@p1 AS decimal(38, 10))) = @p2'],
    ])('renders on %s', (dialect, expected) => {
        expect(sql((x: any) => x.age % 2 === 0, dialect as never).where).toBe(expected);
    });
});
