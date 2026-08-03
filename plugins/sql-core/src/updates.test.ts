import { describe, it, expect } from '@jest/globals';
import { s } from '@routier/core/schema';
import { getDialect } from './sql';
import { buildGroupedUpdateOperations } from './updates';

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
});
