import { describe, it, expect } from '@jest/globals';
import { s } from '@routier/core/schema';
import { buildFromPersistOperation } from '../utils';

/**
 * The mysql plugin has no container-backed suite yet, so the persist builder — the part
 * that decides SQL shape and how rows are read back without RETURNING — is pinned directly.
 */

const knownKeySchema = s.define('mysql_known', {
    id: s.string().key(),
    a: s.string(),
    nested: s.object({ v: s.string() }),
}).compile();

const autoIncrementSchema = s.define('mysql_autoinc', {
    id: s.number().key().identity(),
    a: s.string(),
}).compile();

const uuidIdentitySchema = s.define('mysql_uuid', {
    id: s.string().key().identity(),
    a: s.string(),
}).compile();

const compositeKeySchema = s.define('mysql_composite', {
    p: s.string().key(),
    q: s.string().key(),
    a: s.string(),
}).compile();

const changes = (adds: unknown[], updates: unknown[] = [], removes: unknown[] = []) => ({
    adds,
    updates,
    removes,
    hasItems: adds.length + updates.length + removes.length > 0,
}) as any;

describe('mysql buildFromPersistOperation', () => {
    describe('adds', () => {
        it('JSON-encodes nested values and selects back by known keys', () => {
            const { adds } = buildFromPersistOperation(knownKeySchema as any, changes([
                { id: 'x', a: '1', nested: { v: 'n' } },
            ]));

            expect(adds!.sql).toBe('INSERT INTO `mysql_known` (`id`, `a`, `nested`) VALUES (?, ?, ?)');
            expect(adds!.params).toEqual(['x', '1', JSON.stringify({ v: 'n' })]);
            expect(adds!.selectBack).toEqual({ mode: 'by-key', ids: ['x'] });
        });

        it('selects a numeric identity insert back by its consecutive id block', () => {
            const { adds } = buildFromPersistOperation(autoIncrementSchema as any, changes([
                { a: '1' },
                { a: '2' },
            ]));

            expect(adds!.sql).toBe('INSERT INTO `mysql_autoinc` (`a`) VALUES (?), (?)');
            expect(adds!.selectBack).toEqual({ mode: 'insert-id', rowCount: 2 });
        });

        it('generates a string identity client-side so the echo is exact', () => {
            // A server-generated UUID cannot be read back without RETURNING — the value is
            // generated here and sent, so the inserted key is knowable.
            const { adds } = buildFromPersistOperation(uuidIdentitySchema as any, changes([{ a: '1' }]));

            expect(adds!.sql).toBe('INSERT INTO `mysql_uuid` (`id`, `a`) VALUES (?, ?)');
            expect(adds!.selectBack.mode).toBe('by-key');

            const ids = (adds!.selectBack as { mode: 'by-key'; ids: unknown[] }).ids;
            expect(ids).toHaveLength(1);
            expect(typeof ids[0]).toBe('string');
            // The generated id is also the first bound parameter.
            expect(adds!.params[0]).toBe(ids[0]);
        });

        it('selects composite-key rows back by full key tuples', () => {
            const { adds } = buildFromPersistOperation(compositeKeySchema as any, changes([
                { p: 'p1', q: 'q1', a: '1' },
            ]));

            expect(adds!.selectBack).toEqual({
                mode: 'by-composite-key',
                keyTuples: [{ p: 'p1', q: 'q1' }],
            });
        });
    });

    describe('updates', () => {
        it('emits one operation per changed-column group, each carrying its row ids', () => {
            const { updates } = buildFromPersistOperation(knownKeySchema as any, changes([], [
                { entity: { id: 'x', a: 'x-new', nested: { v: 'n' } }, delta: { a: 'x-new' } },
                { entity: { id: 'y', a: 'y-new', nested: { v: 'm' } }, delta: { a: 'y-new', nested: { v: 'm' } } },
            ]));

            expect(updates).toHaveLength(2);
            expect(updates[0].sql).toBe('UPDATE `mysql_known` SET `a` = CASE `id` WHEN ? THEN ? ELSE `a` END WHERE `id` IN (?)');
            expect(updates[0].ids).toEqual(['x']);
            expect(updates[1].ids).toEqual(['y']);

            for (const update of updates) {
                expect(update.sql).not.toContain(';');
            }
        });
    });

    describe('removes', () => {
        it('carries a select over the same predicate, to be read BEFORE the delete', () => {
            const { removes } = buildFromPersistOperation(compositeKeySchema as any, changes([], [], [
                { p: 'p1', q: 'q1', a: '1' },
            ]));

            expect(removes!.sql).toBe('DELETE FROM `mysql_composite` WHERE (`p` = ? AND `q` = ?)');
            expect(removes!.selectSql).toBe('SELECT `p`, `q`, `a` FROM `mysql_composite` WHERE (`p` = ? AND `q` = ?)');
            expect(removes!.params).toEqual(['p1', 'q1']);
        });
    });
});
