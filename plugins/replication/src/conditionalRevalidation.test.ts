import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { s } from '@routier/core/schema';
import { logger, uuid } from '@routier/core/utilities';
import { ConditionalRevalidation } from './conditionalRevalidation';
import { RecordingMemoryPlugin } from './__tests__/httpTestKit';

const storedValidators = s.define('_routier_swr_validators', {
    _id: s.string().key(),
    kind: s.string().optional(),
    etag: s.string().optional(),
    rowCount: s.number().optional(),
}).compile();

const KIND = 'routier-swr-validator';
const counting = (count: number | null) => jest.fn(async () => count);

class FlakyStore extends RecordingMemoryPlugin {
    readonly queries: { source: string, action: string, explain: boolean, executed: number }[] = [];
    failQueries = 0;
    failWrites = false;

    override query<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.queries.push({ source: event.source, action: event.action, explain: event.explain, executed: event.executedQueries.length });

        if (this.failQueries > 0) {
            this.failQueries--;
            setTimeout(() => done(PluginEventResult.error(event.id, new Error('read failed'))), 0);
            return;
        }

        super.query(event, done);
    }

    override bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        if (this.failWrites) {
            this.writes.push(event);
            done(PluginEventResult.error(event.id, new Error('write failed')));
            return;
        }

        super.bulkPersist(event, done);
    }
}

const validatorChanges = (event: DbPluginBulkPersistEvent | undefined) => event?.operation.get(storedValidators.id);

describe('ConditionalRevalidation', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const storeWith = (rows: Record<string, string | number>[]) => {
        const store = new FlakyStore(`validators-${uuid(8)}`);
        store.seed(storedValidators, rows);
        return store;
    };

    it('returns the stored etag when the row count matches', async () => {
        const store = storeWith([{ _id: 'k', kind: KIND, etag: '"v1"', rowCount: 2 }]);

        expect(await new ConditionalRevalidation(store).ifNoneMatch('k', counting(2))).toBe('"v1"');
    });

    it('does not count rows when nothing is stored for the query', async () => {
        const countRows = counting(2);

        await new ConditionalRevalidation(storeWith([])).ifNoneMatch('k', countRows);

        expect(countRows).not.toHaveBeenCalled();
    });

    it.each([
        ['the row count differs', { _id: 'k', kind: KIND, etag: '"v1"', rowCount: 2 }, 3],
        ['the rows could not be counted', { _id: 'k', kind: KIND, etag: '"v1"', rowCount: 2 }, null],
        ['the etag is missing', { _id: 'k', kind: KIND, rowCount: 2 }, 2],
        ['the row count is missing', { _id: 'k', kind: KIND, etag: '"v1"' }, 2],
        ['the row is not a validator', { _id: 'k', kind: 'other', etag: '"v1"', rowCount: 2 }, 2],
        ['the row has no kind', { _id: 'k', etag: '"v1"', rowCount: 2 }, 2],
    ])('returns no etag when %s', async (_, stored, rowCount) => {
        expect(await new ConditionalRevalidation(storeWith([stored])).ifNoneMatch('k', counting(rowCount))).toBeNull();
    });

    it('keeps the valid stored etags when another stored row is not a validator', async () => {
        const store = storeWith([{ _id: 'bad', kind: KIND, etag: '"v0"' }, { _id: 'k', kind: KIND, etag: '"v1"', rowCount: 2 }]);

        expect(await new ConditionalRevalidation(store).ifNoneMatch('k', counting(2))).toBe('"v1"');
    });

    it('adds rather than updates over a stored row that is not a validator', async () => {
        const store = storeWith([{ _id: 'k', kind: KIND, etag: '"v0"' }]);

        await new ConditionalRevalidation(store).remember('k', '"v1"', counting(2));

        expect(validatorChanges(store.writes[0])?.adds.map(row => row._id)).toEqual(['k']);
    });

    it('reads its collection with a well-formed query', async () => {
        const store = storeWith([]);

        await new ConditionalRevalidation(store).ifNoneMatch('k', counting(0));

        expect(store.queries[0]).toEqual({ source: 'ConditionalRevalidation', action: 'query', explain: false, executed: 0 });
    });

    it('logs a failed read, answers without an etag, and reads again next time', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = storeWith([{ _id: 'k', kind: KIND, etag: '"v1"', rowCount: 2 }]);
        store.failQueries = 1;
        const conditional = new ConditionalRevalidation(store);

        const first = await conditional.ifNoneMatch('k', counting(2));
        const second = await conditional.ifNoneMatch('k', counting(2));

        expect([first, second]).toEqual([null, '"v1"']);
        expect(warn).toHaveBeenCalledWith('[HttpSwrDbPlugin] could not read stored etags', { error: expect.any(Error) });
    });

    it('adds a new etag, then updates it', async () => {
        const store = storeWith([]);
        const conditional = new ConditionalRevalidation(store);

        await conditional.remember('k', '"v1"', counting(2));
        await conditional.remember('k', '"v2"', counting(3));

        expect(validatorChanges(store.writes[0])?.adds).toEqual([{ _id: 'k', kind: KIND, etag: '"v1"', rowCount: 2 }]);
        expect(validatorChanges(store.writes[1])?.updates).toEqual([{ entity: { _id: 'k', kind: KIND, etag: '"v2"', rowCount: 3 }, changeType: 'markedDirty', delta: {} }]);
        expect(store.writes.map(event => [event.source, event.action])).toEqual([['ConditionalRevalidation', 'persist'], ['ConditionalRevalidation', 'persist']]);
    });

    it('removes a stored etag when the server stops sending one', async () => {
        const store = storeWith([]);
        const conditional = new ConditionalRevalidation(store);

        await conditional.remember('k', '"v1"', counting(2));
        await conditional.remember('k', null, counting(2));

        expect([validatorChanges(store.writes[1])?.removes, await conditional.ifNoneMatch('k', counting(2))]).toEqual([[{ _id: 'k', kind: KIND, etag: '"v1"', rowCount: 2 }], null]);
    });

    it('writes nothing and counts nothing when there is no etag to store or remove', async () => {
        const store = storeWith([]);
        const countRows = counting(2);

        await new ConditionalRevalidation(store).remember('k', null, countRows);

        expect([store.writes, countRows.mock.calls.length]).toEqual([[], 0]);
    });

    it('stores nothing when the rows could not be counted', async () => {
        const store = storeWith([]);

        await new ConditionalRevalidation(store).remember('k', '"v1"', counting(null));

        expect(store.writes).toEqual([]);
    });

    it('forgets the etags of queries that start with a prefix', async () => {
        const store = storeWith([]);
        const conditional = new ConditionalRevalidation(store);
        await conditional.remember('1|a', '"v1"', counting(1));
        await conditional.remember('1|b', '"v2"', counting(1));
        await conditional.remember('2|a', '"v3"', counting(1));

        await conditional.forget('1|');

        expect(validatorChanges(store.writes[3])?.removes.map(row => row._id)).toEqual(['1|a', '1|b']);
        expect(await conditional.ifNoneMatch('2|a', counting(1))).toBe('"v3"');
        expect(await conditional.ifNoneMatch('1|a', counting(1))).toBeNull();
    });


    it('writes nothing when no stored etag matches the prefix', async () => {
        const store = storeWith([]);
        const conditional = new ConditionalRevalidation(store);
        await conditional.remember('2|a', '"v3"', counting(1));

        await conditional.forget('1|');

        expect(store.writes.length).toBe(1);
    });

    it('logs a failed write and still resolves', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = storeWith([]);
        store.failWrites = true;

        await new ConditionalRevalidation(store).remember('k', '"v1"', counting(2));

        expect(warn).toHaveBeenCalledWith('[HttpSwrDbPlugin] could not store etag', { error: expect.any(Error) });
    });

    it('does not log a successful update or removal', async () => {
        const store = storeWith([]);
        const conditional = new ConditionalRevalidation(store);
        await conditional.remember('k', '"v1"', counting(2));
        const warn = jest.spyOn(logger, 'warn');

        await conditional.remember('k', '"v2"', counting(2));
        await conditional.forget('k');

        expect(warn).not.toHaveBeenCalled();
    });

    it('does not log a successful write', async () => {
        const warn = jest.spyOn(logger, 'warn');

        await new ConditionalRevalidation(storeWith([])).remember('k', '"v1"', counting(2));

        expect(warn).not.toHaveBeenCalled();
    });
});
