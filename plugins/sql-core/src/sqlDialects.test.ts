import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { toExpression } from '@routier/core/expressions';
import { getDialect, toSql, type SqlDialectName } from './sql';

/**
 * The SQL dialect matrix.
 *
 * `sql.ts` carries four dialects that differ in identifier quoting, placeholder syntax,
 * string-match operator, and LIKE escape clause. The existing suite touched each dialect
 * once or twice, which left most of those differences unasserted — mutation testing found 63
 * survivors here, the largest cluster outside the parser.
 *
 * The differences are exactly where a plugin breaks against a real server: a placeholder in
 * the wrong syntax is a bind error, and an unescaped identifier is a syntax error or, worse,
 * an injection. Each dialect therefore gets every behavior asserted, including escaping of
 * its own quote character.
 */

const schema = s.define('sql_dialects', {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
    active: s.boolean(),
}).compile();

const ALL_DIALECTS: SqlDialectName[] = ['sqlite', 'postgresql', 'mysql', 'mssql'];

/** Parses a filter into an expression for toSql to consume. */
const expr = (fn: any, params?: any) =>
    params === undefined ? toExpression(schema as any, fn) : toExpression(schema as any, fn, params);

describe('getDialect', () => {
    it.each(ALL_DIALECTS)('returns a dialect for %s', name => {
        expect(getDialect(name)).toBeDefined();
    });

    it('throws for an unknown dialect', () => {
        expect(() => getDialect('oracle' as any)).toThrow(/Unknown SQL dialect/);
    });
});

describe('identifier quoting', () => {
    it('wraps sqlite identifiers in double quotes', () => {
        expect(getDialect('sqlite').quoteIdentifier('name')).toBe('"name"');
    });

    it('wraps postgresql identifiers in double quotes', () => {
        expect(getDialect('postgresql').quoteIdentifier('name')).toBe('"name"');
    });

    it('wraps mysql identifiers in backticks', () => {
        expect(getDialect('mysql').quoteIdentifier('name')).toBe('`name`');
    });

    it('wraps mssql identifiers in square brackets', () => {
        expect(getDialect('mssql').quoteIdentifier('name')).toBe('[name]');
    });

    // Doubling the quote character is what stops an identifier from terminating early.
    // Getting it wrong turns a column name into a syntax error or an injection point.
    it('doubles an embedded double quote for sqlite', () => {
        expect(getDialect('sqlite').quoteIdentifier('we"ird')).toBe('"we""ird"');
    });

    it('doubles an embedded double quote for postgresql', () => {
        expect(getDialect('postgresql').quoteIdentifier('we"ird')).toBe('"we""ird"');
    });

    it('doubles an embedded backtick for mysql', () => {
        expect(getDialect('mysql').quoteIdentifier('we`ird')).toBe('`we``ird`');
    });

    it('doubles an embedded closing bracket for mssql', () => {
        expect(getDialect('mssql').quoteIdentifier('we]ird')).toBe('[we]]ird]');
    });

    it.each(ALL_DIALECTS)('leaves an ordinary identifier intact for %s', name => {
        expect(getDialect(name).quoteIdentifier('plain')).toContain('plain');
    });

    it('escapes every occurrence, not just the first', () => {
        expect(getDialect('mysql').quoteIdentifier('a`b`c')).toBe('`a``b``c`');
    });
});

describe('parameter placeholders', () => {
    it('uses positional question marks for sqlite', () => {
        const dialect = getDialect('sqlite');

        expect([0, 1, 2].map(i => dialect.getPlaceholder(i))).toEqual(['?', '?', '?']);
    });

    it('uses one-based dollar placeholders for postgresql', () => {
        const dialect = getDialect('postgresql');

        // $1 for index 0: an off-by-one here binds every parameter to the wrong column.
        expect([0, 1, 2].map(i => dialect.getPlaceholder(i))).toEqual(['$1', '$2', '$3']);
    });

    it('uses positional question marks for mysql', () => {
        const dialect = getDialect('mysql');

        expect([0, 1, 2].map(i => dialect.getPlaceholder(i))).toEqual(['?', '?', '?']);
    });

    it('uses one-based named placeholders for mssql', () => {
        const dialect = getDialect('mssql');

        expect([0, 1, 2].map(i => dialect.getPlaceholder(i))).toEqual(['@p1', '@p2', '@p3']);
    });
});

describe('string matching', () => {
    it('uses GLOB for sqlite', () => {
        expect(getDialect('sqlite').stringMatchKind).toBe('GLOB');
    });

    it.each(['postgresql', 'mysql', 'mssql'] as SqlDialectName[])('uses LIKE for %s', name => {
        expect(getDialect(name).stringMatchKind).toBe('LIKE');
    });

    it('emits no escape clause for sqlite, which has no LIKE escape', () => {
        expect(getDialect('sqlite').likeEscapeClause()).toBe('');
    });

    it('emits an E-prefixed escape clause for postgresql', () => {
        // Postgres needs the E'' form for a backslash escape character.
        expect(getDialect('postgresql').likeEscapeClause()).toContain('ESCAPE');
        expect(getDialect('postgresql').likeEscapeClause()).toContain("E'");
    });

    it.each(['mysql', 'mssql'] as SqlDialectName[])('emits a plain escape clause for %s', name => {
        expect(getDialect(name).likeEscapeClause()).toContain('ESCAPE');
        expect(getDialect(name).likeEscapeClause()).not.toContain("E'");
    });
});

describe('toSql', () => {
    it.each(ALL_DIALECTS)('binds an equality comparison as a parameter for %s', name => {
        const result = toSql(expr((r: any) => r.name === 'x'), name);

        // The value must be bound, never inlined into the SQL text.
        expect(result.params).toEqual(['x']);
        expect(result.where).not.toContain("'x'");
    });

    it('numbers postgresql placeholders in order across multiple conditions', () => {
        const result = toSql(expr((r: any) => r.name === 'x' && r.price > 5), 'postgresql');

        expect(result.params).toEqual(['x', 5]);
        expect(result.where).toContain('$1');
        expect(result.where).toContain('$2');
    });

    it('numbers mssql placeholders in order across multiple conditions', () => {
        const result = toSql(expr((r: any) => r.name === 'x' && r.price > 5), 'mssql');

        expect(result.params).toEqual(['x', 5]);
        expect(result.where).toContain('@p1');
        expect(result.where).toContain('@p2');
    });

    it('emits one question mark per parameter for sqlite', () => {
        const result = toSql(expr((r: any) => r.name === 'x' && r.price > 5), 'sqlite');

        expect(result.params).toEqual(['x', 5]);
        expect(result.where.split('?').length - 1).toBe(2);
    });

    it.each(ALL_DIALECTS)('renders AND for %s', name => {
        expect(toSql(expr((r: any) => r.name === 'x' && r.price > 5), name).where).toMatch(/AND/i);
    });

    it.each(ALL_DIALECTS)('renders OR for %s', name => {
        expect(toSql(expr((r: any) => r.name === 'x' || r.price > 5), name).where).toMatch(/OR/i);
    });

    it.each(ALL_DIALECTS)('quotes the column with the dialect quoting for %s', name => {
        const result = toSql(expr((r: any) => r.name === 'x'), name);

        expect(result.where).toContain(getDialect(name).quoteIdentifier('name'));
    });

    it('uses GLOB for a sqlite prefix match', () => {
        expect(toSql(expr((r: any) => r.name.startsWith('a')), 'sqlite').where).toMatch(/GLOB/i);
    });

    it.each(['postgresql', 'mysql', 'mssql'] as SqlDialectName[])('uses LIKE for a %s prefix match', name => {
        expect(toSql(expr((r: any) => r.name.startsWith('a')), name).where).toMatch(/LIKE/i);
    });

    it.each(ALL_DIALECTS)('binds a boolean comparison for %s, including false', name => {
        expect(toSql(expr((r: any) => r.active === false), name).params).toEqual([false]);
    });

    it.each(ALL_DIALECTS)('binds a zero without dropping it for %s', name => {
        expect(toSql(expr((r: any) => r.price === 0), name).params).toEqual([0]);
    });

    it.each(ALL_DIALECTS)('accepts a dialect object as well as a name for %s', name => {
        const byName = toSql(expr((r: any) => r.name === 'x'), name);
        const byObject = toSql(expr((r: any) => r.name === 'x'), getDialect(name));

        expect(byObject).toEqual(byName);
    });
});
