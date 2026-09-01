import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { toSql } from './sql';

/**
 * The SQL half of the evidence for lifting the parser's casing guards.
 *
 * Its stated reason was that "on relational comparators the plugins would silently ignore them and
 * return wrong data", which made `renderColumn`'s LOWER path for those comparators unreachable. The
 * predicate list is shared with `core/src/expressions/casingComparators.test.ts`, which asserts the
 * answer a row gets, and with the mongodb file of the same name.
 */

const schema = s.define('casing', {
    id: s.string().key(),
    name: s.string(),
    other: s.string(),
}).compile();

const where = (filter: (entity: any) => boolean, dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql') =>
    toSql(toExpression(schema as never, filter as never, undefined as never), dialect);

describe('a casing call on a relational comparator', () => {

    it('wraps the column in LOWER on every dialect', () => {
        expect(where((x: any) => x.name.toLowerCase() === 'ada', 'sqlite').where).toBe('LOWER("name") = ?');
        expect(where((x: any) => x.name.toLowerCase() === 'ada', 'postgresql').where).toBe('LOWER("name") = $1');
        expect(where((x: any) => x.name.toLowerCase() === 'ada', 'mysql').where).toBe('LOWER(`name`) = ?');
        expect(where((x: any) => x.name.toLowerCase() === 'ada', 'mssql').where).toBe('LOWER([name]) = @p1');
    });

    it('binds the compared value as a parameter, not into the text', () => {
        expect(where((x: any) => x.name.toLowerCase() === 'ada', 'sqlite').params).toEqual(['ada']);
    });

    it.each([
        ['greater-than', (x: any) => x.name.toUpperCase() > 'M', 'UPPER("name") > ?'],
        ['greater-than-equals', (x: any) => x.name.toUpperCase() >= 'M', 'UPPER("name") >= ?'],
        ['less-than', (x: any) => x.name.toLowerCase() < 'b', 'LOWER("name") < ?'],
        ['less-than-equals', (x: any) => x.name.toLowerCase() <= 'b', 'LOWER("name") <= ?'],
    ])('renders %s, which was unreachable while the guard stood', (_, filter, expected) => {
        expect(where(filter, 'sqlite').where).toBe(expected);
    });

    it('renders a call on both sides of a property-to-property comparison', () => {
        expect(where((x: any) => x.name.toLowerCase() === x.other.toLowerCase(), 'sqlite').where)
            .toBe('LOWER("name") = LOWER("other")');
    });

    it('renders a called property against a plain one', () => {
        expect(where((x: any) => x.name === x.other.toLowerCase(), 'sqlite').where)
            .toBe('"name" = LOWER("other")');
    });

    it('folds a call on the VALUE side before binding, rather than emitting LOWER(?)', () => {
        const rendered = where((x: any) => x.name === 'ADA'.toLowerCase(), 'sqlite');

        expect(rendered.where).toBe('"name" = ?');
        expect(rendered.params).toEqual(['ada']);
    });
});
