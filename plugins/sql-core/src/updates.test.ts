import { describe, it, expect } from '@jest/globals';
import { s } from '@routier/core/schema';
import { getDialect } from './sql';
import { buildConditionalUpdateOperations, buildGroupedUpdateOperations } from './updates';

const schema = s.define('t', {
    id: s.string().key(),
    a: s.string(),
    b: s.number(),
    nested: s.object({ value: s.string() }),
}).compile();

const update = (id: string, delta: Record<string, unknown>, entity?: Record<string, unknown>) => ({
    entity: { id, a: 'a', b: 1, nested: { value: 'v' }, ...entity },
    delta,
});

describe('buildGroupedUpdateOperations', () => {
    it('returns nothing for no updates', () => {
        expect(buildGroupedUpdateOperations(schema, [], getDialect('sqlite'))).toEqual([]);
    });

    it('puts updates with the same changed columns into one statement', () => {
        const ops = buildGroupedUpdateOperations(schema, [
            update('x', { a: 'x-new' }),
            update('y', { a: 'y-new' }),
        ], getDialect('sqlite'));

        expect(ops).toHaveLength(1);
        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = CASE "id" WHEN ? THEN ? WHEN ? THEN ? ELSE "a" END WHERE "id" IN (?, ?)');
        expect(ops[0].params).toEqual(['x', 'x-new', 'y', 'y-new', 'x', 'y']);
        expect(ops[0].ids).toEqual(['x', 'y']);
    });

    it('emits one statement PER changed-column group, never joined (defect #22)', () => {
        const ops = buildGroupedUpdateOperations(schema, [
            update('x', { a: 'x-new' }),
            update('y', { a: 'y-new', b: 99 }),
        ], getDialect('postgresql'));

        expect(ops).toHaveLength(2);
        for (const op of ops) {
            expect(op.sql).not.toContain(';');
        }
    });

    it('numbers each statement\'s placeholders from the dialect\'s first', () => {
        const ops = buildGroupedUpdateOperations(schema, [
            update('x', { a: 'x-new' }),
            update('y', { b: 99 }),
        ], getDialect('postgresql'));

        expect(ops).toHaveLength(2);
        // Both statements start at $1 — a shared counter across groups is what made the
        // groups inseparable before.
        expect(ops[0].sql).toContain('WHEN $1 THEN $2');
        expect(ops[1].sql).toContain('WHEN $1 THEN $2');
        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = CASE "id" WHEN $1 THEN $2 ELSE "a" END WHERE "id" IN ($3)');
    });

    it('quotes identifiers with the dialect', () => {
        const ops = buildGroupedUpdateOperations(schema, [update('x', { a: 'x-new' })], getDialect('mysql'));

        expect(ops[0].sql).toBe('UPDATE `t` SET `a` = CASE `id` WHEN ? THEN ? ELSE `a` END WHERE `id` IN (?)');
    });

    it('appends the suffix verbatim (RETURNING for engines that have it)', () => {
        const ops = buildGroupedUpdateOperations(schema, [update('x', { a: 'x-new' })], getDialect('sqlite'), { suffix: ' RETURNING "id", "a"' });

        expect(ops[0].sql.endsWith(' RETURNING "id", "a"')).toBe(true);
    });

    it('falls back to every non-identity property when the delta is empty', () => {
        const ops = buildGroupedUpdateOperations(schema, [update('x', {})], getDialect('sqlite'));

        expect(ops).toHaveLength(1);
        expect(ops[0].sql).toContain('"a" = CASE');
        expect(ops[0].sql).toContain('"b" = CASE');
        expect(ops[0].sql).toContain('"nested" = CASE');
        expect(ops[0].sql).not.toContain('"id" = CASE');
    });

    it('takes a JSON column\'s value from the ENTITY and encodes it', () => {
        // A nested subtree is one column; the delta selects it, the entity supplies the
        // whole merged value — a partial subtree would drop unchanged siblings.
        const ops = buildGroupedUpdateOperations(schema, [
            update('x', { nested: { value: 'changed' } }, { nested: { value: 'changed' } }),
        ], getDialect('sqlite'));

        expect(ops[0].params).toContain(JSON.stringify({ value: 'changed' }));
    });

    it('reports the full identity of every updated row', () => {
        const ops = buildGroupedUpdateOperations(schema, [
            update('x', { a: 'x-new' }),
            update('y', { a: 'y-new' }),
        ], getDialect('sqlite'));

        expect(ops[0].keyTuples).toEqual([{ id: 'x' }, { id: 'y' }]);
    });
});

// Every test here uses rows that SHARE their first key component. That is the whole
// point: a WHERE built from `idProperties[0]` alone still produces valid SQL and still
// reports rows affected — it just writes one row's values over its siblings. Only an
// assertion on the emitted predicate catches it.
describe('buildGroupedUpdateOperations — composite keys', () => {
    const composite = s.define('t', {
        tenant: s.string().key(),
        id: s.string().key(),
        a: s.string(),
        b: s.number(),
    }).compile();

    const row = (tenant: string, id: string, delta: Record<string, unknown>) => ({
        entity: { tenant, id, a: 'a', b: 1 },
        delta,
    });

    it('emits one full-key UPDATE per row instead of a CASE over the first component', () => {
        const ops = buildGroupedUpdateOperations(composite, [
            row('acme', 'shared', { a: 'first' }),
            row('globex', 'shared', { a: 'second' }),
        ], getDialect('sqlite'));

        expect(ops).toHaveLength(2);
        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = ? WHERE "tenant" = ? AND "id" = ?');
        expect(ops[0].params).toEqual(['first', 'acme', 'shared']);
        expect(ops[1].sql).toBe('UPDATE "t" SET "a" = ? WHERE "tenant" = ? AND "id" = ?');
        expect(ops[1].params).toEqual(['second', 'globex', 'shared']);
    });

    it('never emits a predicate naming only part of the key', () => {
        const ops = buildGroupedUpdateOperations(composite, [
            row('acme', 'shared', { a: 'first' }),
            row('globex', 'shared', { a: 'second' }),
        ], getDialect('postgresql'));

        for (const op of ops) {
            expect(op.sql).toContain('"tenant" =');
            expect(op.sql).toContain('"id" =');
            expect(op.sql).not.toContain('CASE');
            expect(op.sql).not.toContain('IN (');
        }
    });

    it('carries the full key tuple for select-back, not a bare id', () => {
        const ops = buildGroupedUpdateOperations(composite, [
            row('acme', 'shared', { a: 'first' }),
        ], getDialect('mysql'));

        expect(ops[0].keyTuples).toEqual([{ tenant: 'acme', id: 'shared' }]);
    });

    it('numbers each row\'s placeholders from the dialect\'s first', () => {
        const ops = buildGroupedUpdateOperations(composite, [
            row('acme', 'shared', { a: 'first' }),
            row('globex', 'shared', { a: 'second' }),
        ], getDialect('postgresql'));

        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = $1 WHERE "tenant" = $2 AND "id" = $3');
        expect(ops[1].sql).toBe('UPDATE "t" SET "a" = $1 WHERE "tenant" = $2 AND "id" = $3');
    });

    it('quotes composite identifiers with the dialect', () => {
        const ops = buildGroupedUpdateOperations(composite, [
            row('acme', 'shared', { a: 'first' }),
        ], getDialect('mysql'));

        expect(ops[0].sql).toBe('UPDATE `t` SET `a` = ? WHERE `tenant` = ? AND `id` = ?');
    });

    it('appends the suffix to every per-row statement', () => {
        const ops = buildGroupedUpdateOperations(composite, [
            row('acme', 'shared', { a: 'first' }),
            row('globex', 'shared', { b: 2 }),
        ], getDialect('sqlite'), { suffix: ' RETURNING "id"' });

        expect(ops).toHaveLength(2);
        for (const op of ops) {
            expect(op.sql.endsWith(' RETURNING "id"')).toBe(true);
        }
    });

    it('excludes every identity column from the empty-delta fallback', () => {
        const ops = buildGroupedUpdateOperations(composite, [
            row('acme', 'shared', {}),
        ], getDialect('sqlite'));

        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = ?, "b" = ? WHERE "tenant" = ? AND "id" = ?');
    });
});

describe('buildConditionalUpdateOperations', () => {
    const single = s.define('t', {
        id: s.string().key(),
        a: s.string(),
    }).compile();

    const composite = s.define('t', {
        tenant: s.string().key(),
        id: s.string().key(),
        a: s.string(),
    }).compile();

    it('returns nothing for no updates', () => {
        expect(buildConditionalUpdateOperations(single, [], getDialect('sqlite'))).toEqual([]);
    });

    it('checks the token alongside the key', () => {
        const ops = buildConditionalUpdateOperations(single, [{
            entity: { id: 'x', a: 'a' },
            delta: { a: 'new' },
            concurrency: { column: 'rev', expected: 3 },
        }], getDialect('postgresql'));

        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = $1 WHERE "id" = $2 AND "rev" = $3');
        expect(ops[0].params).toEqual(['new', 'x', 3]);
        expect(ops[0].checked).toBe(true);
        expect(ops[0].id).toBe('x');
    });

    it('omits the token clause for rows that predate the token', () => {
        const ops = buildConditionalUpdateOperations(single, [{
            entity: { id: 'x', a: 'a' },
            delta: { a: 'new' },
        }], getDialect('sqlite'));

        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = ? WHERE "id" = ?');
        expect(ops[0].checked).toBe(false);
    });

    it('ANDs every identity column ahead of the token', () => {
        const ops = buildConditionalUpdateOperations(composite, [{
            entity: { tenant: 'acme', id: 'shared', a: 'a' },
            delta: { a: 'new' },
            concurrency: { column: 'rev', expected: 3 },
        }], getDialect('sqlite'));

        expect(ops[0].sql).toBe('UPDATE "t" SET "a" = ? WHERE "tenant" = ? AND "id" = ? AND "rev" = ?');
        expect(ops[0].params).toEqual(['new', 'acme', 'shared', 3]);
        expect(ops[0].keyTuple).toEqual({ tenant: 'acme', id: 'shared' });
    });

    it('names a composite-key row in a way a conflict message can print', () => {
        const ops = buildConditionalUpdateOperations(composite, [{
            entity: { tenant: 'acme', id: 'shared', a: 'a' },
            delta: { a: 'new' },
            concurrency: { column: 'rev', expected: 1 },
        }], getDialect('sqlite'));

        // OptimisticConcurrencyError stringifies what it is handed, so an object here
        // would reach the user as "[object Object]".
        expect(String(ops[0].id)).toBe('acme|shared');
    });

    it('keeps rows sharing a first key component independent', () => {
        const ops = buildConditionalUpdateOperations(composite, [
            { entity: { tenant: 'acme', id: 'shared', a: 'a' }, delta: { a: 'first' } },
            { entity: { tenant: 'globex', id: 'shared', a: 'a' }, delta: { a: 'second' } },
        ], getDialect('sqlite'));

        expect(ops).toHaveLength(2);
        expect(ops[0].params).toEqual(['first', 'acme', 'shared']);
        expect(ops[1].params).toEqual(['second', 'globex', 'shared']);
    });
});
