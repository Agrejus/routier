import { describe, expect, it, jest } from '@jest/globals';
import { etags, s } from '@routier/core/schema';
import type { CompiledSchema } from '@routier/core/schema';
import type { UnknownRecord } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpStatusError, NetworkError } from './httpUtils';
import { baseOf, createConflictSettler, isConflictResponse, remoteInResponse, requeuedChange, sameKeys } from './conflictSettler';
import { UnsyncedQueue, type UnsyncedFlushUnit } from './UnsyncedQueue';
import { logger } from '@routier/core/utilities';

const schema: CompiledSchema<UnknownRecord> = s.define('settlerTodos', {
    id: s.string().key(),
    title: s.string(),
    version: s.number().etag(etags.numeric).optional(),
}).compile() as never;

const plainSchema: CompiledSchema<UnknownRecord> = s.define('settlerPlain', {
    id: s.string().key(),
    title: s.string(),
}).compile() as never;

const nestedSchema: CompiledSchema<UnknownRecord> = s.define('settlerNested', {
    id: s.string().key(),
    address: s.object({ street: s.string() }),
}).compile() as never;

const local = { id: 't1', title: 'Mine', version: 1 };
const conflictWith = (body: unknown) => new HttpStatusError(409, 'conflict', null, body, { get: () => null });

describe('isConflictResponse', () => {
    it('is an HTTP 409', () => {
        expect(isConflictResponse({ kind: 'http', status: 409, headers: { get: () => null }, body: null })).toBe(true);
        expect(isConflictResponse({ kind: 'http', status: 412, headers: { get: () => null }, body: null })).toBe(false);
        expect(isConflictResponse({ kind: 'network' })).toBe(false);
    });
});

describe('remoteInResponse', () => {
    it.each([
        ['the body', { id: 't1', title: 'Theirs' }],
        ['its current field', { current: { id: 't1', title: 'Theirs' } }],
        ['its remote field', { remote: { id: 't1', title: 'Theirs' } }],
    ])('finds the server row in %s', (_, body) => {
        expect(remoteInResponse(schema, local, conflictWith(body))).toEqual({ id: 't1', title: 'Theirs' });
    });

    it('ignores a row with another key', () => {
        expect(remoteInResponse(schema, local, conflictWith({ id: 't2', title: 'Theirs' }))).toBeNull();
    });

    it('ignores a body that is not an object', () => {
        expect(remoteInResponse(schema, local, conflictWith('stale'))).toBeNull();
        expect(remoteInResponse(schema, local, conflictWith([{ id: 't1' }]))).toBeNull();
        expect(remoteInResponse(schema, local, new NetworkError(new Error('offline')))).toBeNull();
    });
});

describe('baseOf', () => {
    const stored = { id: 't1', title: 'Write', version: 1 };

    it('picks the fields the update changes', () => {
        expect(baseOf(schema, stored, { title: 'Mine' })).toEqual({ title: 'Write' });
    });

    it('picks every root field when the update writes the whole row', () => {
        expect(baseOf(schema, stored, {})).toStrictEqual(stored);
    });

    it('picks a nested object whole, not its inner fields', () => {
        expect(baseOf(nestedSchema, { id: 'a', address: { street: 'Main' }, street: 'stray' }, {})).toStrictEqual({ id: 'a', address: { street: 'Main' } });
    });

    it('leaves out a field the stored row does not hold', () => {
        expect(baseOf(schema, { id: 't1', title: 'Write' }, { version: 2 })).toStrictEqual({});
    });

    it('is empty when there is no stored row', () => {
        expect(baseOf(schema, undefined, { title: 'Mine' })).toStrictEqual({});
    });
});

describe('sameKeys', () => {
    it('compares rows by key alone', () => {
        expect(sameKeys(schema, { id: 't1', title: 'a' }, { id: 't1', title: 'b' })).toBe(true);
        expect(sameKeys(schema, { id: 't1' }, { id: 't2' })).toBe(false);
    });
});

describe('requeuedChange', () => {
    it('adds the row when the server has none', () => {
        expect(requeuedChange(schema, local, null)).toEqual({ entity: local, change: { kind: 'add', entity: local } });
    });

    it('updates only the fields that differ from the server, over its version', () => {
        expect(requeuedChange(schema, { id: 't1', title: 'Mine', version: 1 }, { id: 't1', title: 'Theirs', version: 2 })).toEqual({
            entity: { id: 't1', title: 'Mine', version: 2 },
            change: { kind: 'update', entity: { id: 't1', title: 'Mine', version: 2 }, payload: { id: 't1', title: 'Mine', version: 2 }, base: { title: 'Theirs' } },
        });
    });

    it('keeps the row as it is when the schema has no version', () => {
        expect(requeuedChange(plainSchema, { id: 't1', title: 'Mine' }, { id: 't1', title: 'Theirs' })?.entity).toStrictEqual({ id: 't1', title: 'Mine' });
    });

    it('is nothing when the row already matches the server', () => {
        expect(requeuedChange(schema, { id: 't1', title: 'Theirs', version: 1 }, { id: 't1', title: 'Theirs', version: 2 })).toBeNull();
    });
});

describe('createConflictSettler', () => {
    const unit = (entity: unknown): UnsyncedFlushUnit => ({ rows: [], kind: 'update', entity, payload: entity, opId: null, base: {} });

    const settler = (fetchRemote: () => Promise<UnknownRecord | null>, schemaOf: () => CompiledSchema<UnknownRecord> | null = () => schema, isConflict = isConflictResponse) => {
        const queue = new UnsyncedQueue(new MemoryPlugin(`settler-${Math.random()}`));
        const recordFailedAttempt = jest.spyOn(queue, 'recordFailedAttempt').mockResolvedValue();
        const resolver = jest.fn(() => null);
        const settle = createConflictSettler(resolver, isConflict, {
            queue,
            schemaOf,
            fetchRemote,
            applyRow: async () => undefined,
            flushSoon: () => undefined,
        });

        return { settle, resolver, recordFailedAttempt };
    };

    it('says which errors are conflicts', () => {
        const { settle } = settler(async () => null);

        expect(settle.isConflict(conflictWith(null))).toBe(true);
        expect(settle.isConflict(new HttpStatusError(500, 'x', null, null, { get: () => null }))).toBe(false);
        expect(settle.isConflict(new Error('not a request'))).toBe(false);
    });

    it('never asks isConflict about an error that did not come from a request', () => {
        const isConflict = jest.fn(() => true);
        const { settle } = settler(async () => null, () => schema, isConflict);

        expect(settle.isConflict(new Error('store failed'))).toBe(false);
        expect(isConflict).not.toHaveBeenCalled();
    });

    it('rejects a change for a collection it has no schema for', async () => {
        const fetchRemote = jest.fn(async () => null);
        const { settle, resolver } = settler(fetchRemote, () => null);

        expect(await settle.settle('unknown', unit(local), conflictWith(null))).toBe('reject');
        expect(resolver).not.toHaveBeenCalled();
        expect(fetchRemote).not.toHaveBeenCalled();
    });

    it('rejects a change whose row is not an object', async () => {
        const { settle } = settler(async () => null);

        expect(await settle.settle('settlerTodos', unit('t1'), conflictWith(null))).toBe('reject');
    });

    it('keeps the change queued, without asking the resolver, when the server row cannot be read', async () => {
        const { settle, resolver, recordFailedAttempt } = settler(async () => { throw new Error('offline'); });
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

        expect(await settle.settle('settlerTodos', unit(local), conflictWith(null))).toEqual({ sent: 0, failed: 1, rejected: 0, resolved: 0 });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not read the server row for a conflict'), expect.objectContaining({ collectionName: 'settlerTodos' }));
        expect(resolver).not.toHaveBeenCalled();
        expect(recordFailedAttempt).toHaveBeenCalledTimes(1);
    });
});
