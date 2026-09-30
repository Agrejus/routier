import { describe, expect, it } from '@jest/globals';
import { etags, s } from '@routier/core/schema';
import { etagIncrementClauses, sqlEtagOf, withEtagValue } from './etags';
import { getDialect } from './sql';
import { buildConditionalUpdateOperations, buildGroupedUpdateOperations } from './updates';

const numbered = s.define('n', {
    id: s.string().key(),
    a: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const tokened = s.define('t', {
    id: s.string().key(),
    a: s.string(),
    revision: s.string().etag(etags.lexical),
}).compile();

const composite = s.define('c', {
    p: s.string().key(),
    q: s.string().key(),
    a: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const plain = s.define('p', {
    id: s.string().key(),
    a: s.string(),
}).compile();

const sqlite = getDialect('sqlite');
const TOKEN = /^[0-9a-z]{15}$/;

describe('sqlEtagOf', () => {
    it('is null for a schema without an etag', () => {
        expect(sqlEtagOf(plain, undefined)).toBeNull();
    });

    it('increments a number etag it generates', () => {
        expect(sqlEtagOf(numbered, 'generate')).toEqual({ kind: 'increment', column: 'version' });
    });

    it('generates a fresh token for a string etag', () => {
        const etag = sqlEtagOf(tokened, undefined);

        expect(etag?.kind === 'value' ? [etag.column, etag.valueOf({ revision: 'old' })] : null).toEqual(['revision', expect.stringMatching(TOKEN)]);
    });

    it('keeps the number etag a row carries', () => {
        const etag = sqlEtagOf(numbered, 'keep');

        expect(etag?.kind === 'value' ? [etag.column, etag.valueOf({ version: 7 })] : null).toEqual(['version', 7]);
    });

    it('keeps the string etag a row carries', () => {
        const etag = sqlEtagOf(tokened, 'keep');

        expect(etag?.kind === 'value' ? [etag.column, etag.valueOf({ revision: 'kept' })] : null).toEqual(['revision', 'kept']);
    });
});

describe('withEtagValue', () => {
    const columns = new Map<string, unknown>([['a', 'x'], ['version', 99]]);

    it('returns the columns untouched without an etag', () => {
        expect(withEtagValue(columns, {}, null)).toBe(columns);
    });

    it('drops the etag column when the database increments it', () => {
        expect([...withEtagValue(columns, {}, { kind: 'increment', column: 'version' })]).toEqual([['a', 'x']]);
    });

    it('replaces the etag column with the value to write', () => {
        const etag = { kind: 'value' as const, column: 'version', valueOf: () => 5 };

        expect([...withEtagValue(columns, {}, etag)]).toEqual([['a', 'x'], ['version', 5]]);
    });

    it('leaves the columns it was given unchanged', () => {
        withEtagValue(columns, {}, { kind: 'increment', column: 'version' });

        expect(columns.has('version')).toBe(true);
    });
});

describe('etagIncrementClauses', () => {
    it.each([
        ['no etag', null],
        ['a written value', { kind: 'value' as const, column: 'version', valueOf: () => 1 }],
    ])('adds nothing for %s', (_, etag) => {
        expect(etagIncrementClauses(etag, sqlite)).toEqual([]);
    });

    it('increments the quoted column, treating null as 0', () => {
        expect(etagIncrementClauses({ kind: 'increment', column: 'version' }, getDialect('mysql'))).toEqual(['`version` = COALESCE(`version`, 0) + 1']);
    });
});

describe('update builders with an etag', () => {
    const rows = [
        { entity: { id: 'x', a: 'x-new', version: 3 }, delta: { a: 'x-new', version: 42 } },
        { entity: { id: 'y', a: 'y-new', version: 8 }, delta: { a: 'y-new' } },
    ];

    it('increments the etag in a grouped update and ignores the value the row sent', () => {
        const [operation] = buildGroupedUpdateOperations(numbered, rows, sqlite, { etag: sqlEtagOf(numbered, undefined) });

        expect(operation?.sql).toBe('UPDATE "n" SET "a" = CASE "id" WHEN ? THEN ? WHEN ? THEN ? ELSE "a" END, "version" = COALESCE("version", 0) + 1 WHERE "id" IN (?, ?)');
        expect(operation?.params).toEqual(['x', 'x-new', 'y', 'y-new', 'x', 'y']);
    });

    it('increments the etag in a composite-key update', () => {
        const [operation] = buildGroupedUpdateOperations(composite, [{ entity: { p: 'a', q: 'b', a: 'new', version: 1 }, delta: { a: 'new' } }], sqlite, { etag: sqlEtagOf(composite, undefined) });

        expect(operation?.sql).toBe('UPDATE "c" SET "a" = ?, "version" = COALESCE("version", 0) + 1 WHERE "p" = ? AND "q" = ?');
    });

    it('increments the etag in a conditional update and checks the expected one', () => {
        const [operation] = buildConditionalUpdateOperations(numbered, [{ ...rows[1]!, concurrency: { column: 'version', expected: 8 } }], sqlite, { etag: sqlEtagOf(numbered, undefined) });

        expect(operation?.sql).toBe('UPDATE "n" SET "a" = ?, "version" = COALESCE("version", 0) + 1 WHERE "id" = ? AND "version" = ?');
        expect(operation?.params).toEqual(['y-new', 'y', 8]);
    });

    it('writes the kept etag in a conditional update', () => {
        const [operation] = buildConditionalUpdateOperations(numbered, [rows[1]!], sqlite, { etag: sqlEtagOf(numbered, 'keep') });

        expect([operation?.sql, operation?.params]).toEqual(['UPDATE "n" SET "a" = ?, "version" = ? WHERE "id" = ?', ['y-new', 8, 'y']]);
    });

    it('writes a fresh token for a string etag', () => {
        const [operation] = buildGroupedUpdateOperations(tokened, [{ entity: { id: 'x', a: 'new', revision: 'old' }, delta: { a: 'new' } }], sqlite, { etag: sqlEtagOf(tokened, undefined) });

        expect(operation?.params).toEqual(['x', 'new', 'x', expect.stringMatching(TOKEN), 'x']);
    });

    it('builds the same statements as before for a schema without an etag', () => {
        const [operation] = buildGroupedUpdateOperations(plain, [{ entity: { id: 'x', a: 'new' }, delta: { a: 'new' } }], sqlite, { etag: sqlEtagOf(plain, undefined) });

        expect(operation?.sql).toBe('UPDATE "p" SET "a" = CASE "id" WHEN ? THEN ? ELSE "a" END WHERE "id" IN (?)');
    });
});
