import { describe, expect, it } from '@jest/globals';
import { toExpression } from '@routier/core/expressions';
import { s } from '@routier/core/schema';
import { canRenderInSql, toSql } from './sql';

/** The SQL half of the rest of the grammar. Predicate list shared with core and mongodb. */

const schema = s.define('piece_two', {
    id: s.string().key(),
    name: s.string().nullable(),
    other: s.string(),
    age: s.number(),
    flags: s.number(),
}).compile();

type Dialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

const sql = (filter: (entity: any) => boolean, dialect: Dialect = 'sqlite') =>
    toSql(toExpression(schema as never, filter as never, undefined as never), dialect);

const can = (filter: (entity: any) => boolean, dialect: Dialect) =>
    canRenderInSql(toExpression(schema as never, filter as never, undefined as never), dialect);

describe('universally supported calls', () => {

    it.each([
        ['bitwise and', (x: any) => (x.flags & 6) === 4, '("flags" & ?) = ?'],
        ['bitwise or', (x: any) => (x.flags | 1) === 5, '("flags" | ?) = ?'],
        ['bitwise not', (x: any) => ~x.flags === -5, '~"flags" = ?'],
        ['coalesce', (x: any) => (x.name ?? 'none') === 'ada', 'COALESCE("name", ?) = ?'],
        ['concat', (x: any) => x.name === `${x.other}!`, '"name" = ("other" || ?)'],
    ])('renders %s on sqlite', (_, filter, expected) => {
        expect(sql(filter).where).toBe(expected);
    });

    /**
     * Rendered, but declared by no dialect yet: PostgreSQL rejects a CASE whose branches do not
     * unify, so it runs in memory everywhere until each engine is checked against a real server.
     */
    it('renders the conditional operator as a CASE, though no dialect claims it yet', () => {
        expect(sql((x: any) => (x.age > 5 ? x.other : 'small') === 'big').where)
            .toBe('CASE WHEN "age" > ? THEN "other" ELSE ? END = ?');
        expect(can((x: any) => (x.age > 5 ? x.other : 'small') === 'big', 'postgresql')).toBe(false);
    });

    it.each(['sqlite', 'postgresql', 'mysql', 'mssql'] as Dialect[])('every dialect claims coalesce (%s)', dialect => {
        expect(can((x: any) => (x.name ?? 'none') === 'ada', dialect)).toBe(true);
    });
});

describe('calls that differ by engine', () => {

    /** `^` is exponentiation in PostgreSQL, so xor is `#`; SQLite has neither and is built from `|` and `&`. */
    it.each([
        ['sqlite', '(("flags" | ?) - ("flags" & ?)) = ?'],
        // Numbers are stored as double precision, and neither engine has a bitwise operator for
        // that, so the operands are narrowed first
        ['postgresql', '(("flags")::bigint # ($1)::bigint) = $2'],
        ['mysql', '(`flags` ^ ?) = ?'],
        ['mssql', '(CAST([flags] AS bigint) ^ CAST(@p1 AS bigint)) = @p2'],
    ])('renders xor on %s', (dialect, expected) => {
        expect(sql((x: any) => (x.flags ^ 1) === 5, dialect as Dialect).where).toBe(expected);
    });

    it.each([
        ['sqlite', '("name" || ?)'],
        ['postgresql', '("name" || $1)'],
        ['mysql', 'CONCAT(`name`, ?)'],
        ['mssql', '([name] + @p1)'],
    ])('renders concat on %s', (dialect, expected) => {
        expect(sql((x: any) => x.other === `${x.name}!`, dialect as Dialect).where).toContain(expected);
    });

    // SQLite has no POWER, and no engine here has JavaScript's unsigned shift
    it.each([
        ['power', (x: any) => x.age ** 2 === 100, { sqlite: false, postgresql: true, mysql: true, mssql: true }],
        ['shift left', (x: any) => (x.flags << 1) === 8, { sqlite: false, postgresql: true, mysql: true, mssql: false }],
        ['unsigned shift', (x: any) => (x.flags >>> 1) === 2, { sqlite: false, postgresql: false, mysql: false, mssql: false }],
        // Rendered for PG and MySQL, but not claimed: the `= true` wrapper a bare boolean call
        // carries returned no rows on PostgreSQL, so it runs in memory pending a real-server check
        ['matches', (x: any) => /^a/.test(x.name), { sqlite: false, postgresql: false, mysql: false, mssql: false }],
    ])('declares support for %s per dialect', (_, filter, expected) => {
        for (const [dialect, supported] of Object.entries(expected)) {
            expect({ dialect, supported: can(filter, dialect as Dialect) }).toEqual({ dialect, supported });
        }
    });

    it('renders a pattern match where the engine has one, even while not claiming it', () => {
        expect(sql((x: any) => /^a/.test(x.name), 'postgresql').where).toBe('("name" ~ $1) = $2');
        expect(sql((x: any) => /^a/.test(x.name), 'mysql').where).toBe('(`name` REGEXP ?) = ?');
    });

    /**
     * A dialect that does not claim a call must not render it either. Throwing beats emitting
     * something plausible: the plugin is meant to ask `canRenderInSql` first and report a missing
     * capability, and a silent wrong statement would hide that it never did.
     */
    it('refuses to render a call the dialect does not claim', () => {
        expect(() => sql((x: any) => /^a/.test(x.name), 'sqlite')).toThrow(/REGEXP/);
        expect(() => sql((x: any) => (x.flags >>> 1) === 2, 'postgresql')).toThrow(/no SQL form/);
    });
});
