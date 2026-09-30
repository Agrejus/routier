import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { s } from '@routier/core/schema';
import { logger, uuid } from '@routier/core/utilities';
import { ConditionalRevalidation } from './conditionalRevalidation';
import { RecordingMemoryPlugin } from './__tests__/httpTestKit';

const storedValidators = s.define('_routier_swr_validators', {
    cacheKey: s.string().key(),
    etag: s.string().optional(),
    rowCount: s.number().optional(),
}).compile();

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

    it('returns the stored etag when the row count matches', async () => {
        const store = new FlakyStore(`validators-${uuid(8)}`);
        store.seed(storedValidators, [{ cacheKey: 'k', etag: '"v1"', rowCount: 2 }]);

        expect(await new ConditionalRevalidation(store).ifNoneMatch('k', 2)).toBe('"v1"');
    });

    it.each([
        ['the row count differs', { cacheKey: 'k', etag: '"v1"', rowCount: 2 }, 3],
        ['the etag is missing', { cacheKey: 'k', rowCount: 2 }, 2],
        ['the row count is missing', { cacheKey: 'k', etag: '"v1"' }, 2],
    ])('returns no etag when %s', async (_, stored, rowCount) => {
        const store = new FlakyStore(`validators-${uuid(8)}`);
        store.seed(storedValidators, [stored]);

        expect(await new ConditionalRevalidation(store).ifNoneMatch('k', rowCount)).toBeNull();
    });

    it('reads its collection with a well-formed query', async () => {
        const store = new FlakyStore(`validators-${uuid(8)}`);

        await new ConditionalRevalidation(store).ifNoneMatch('k', 0);

        expect(store.queries[0]).toEqual({ source: 'ConditionalRevalidation', action: 'query', explain: false, executed: 0 });
    });

    it('logs a failed read, answers without an etag, and reads again next time', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = new FlakyStore(`validators-${uuid(8)}`);
        store.seed(storedValidators, [{ cacheKey: 'k', etag: '"v1"', rowCount: 2 }]);
        store.failQueries = 1;
        const conditional = new ConditionalRevalidation(store);

        const first = await conditional.ifNoneMatch('k', 2);
        const second = await conditional.ifNoneMatch('k', 2);

        expect([first, second]).toEqual([null, '"v1"']);
        expect(warn).toHaveBeenCalledWith('[HttpSwrDbPlugin] could not read stored etags', { error: expect.any(Error) });
    });

    it('adds a new etag, then updates it', async () => {
        const store = new FlakyStore(`validators-${uuid(8)}`);
        const conditional = new ConditionalRevalidation(store);

        await conditional.remember('k', '"v1"', 2);
        await conditional.remember('k', '"v2"', 3);

        expect(validatorChanges(store.writes[0])?.adds).toEqual([{ cacheKey: 'k', etag: '"v1"', rowCount: 2 }]);
        expect(validatorChanges(store.writes[1])?.updates).toEqual([{ entity: { cacheKey: 'k', etag: '"v2"', rowCount: 3 }, changeType: 'markedDirty', delta: {} }]);
        expect(store.writes.map(event => [event.source, event.action])).toEqual([['ConditionalRevalidation', 'persist'], ['ConditionalRevalidation', 'persist']]);
    });

    it('removes a stored etag when the server stops sending one', async () => {
        const store = new FlakyStore(`validators-${uuid(8)}`);
        const conditional = new ConditionalRevalidation(store);

        await conditional.remember('k', '"v1"', 2);
        await conditional.remember('k', null, 2);

        expect([validatorChanges(store.writes[1])?.removes, await conditional.ifNoneMatch('k', 2)]).toEqual([[{ cacheKey: 'k', etag: '"v1"', rowCount: 2 }], null]);
    });

    it('writes nothing when there is no etag to store or remove', async () => {
        const store = new FlakyStore(`validators-${uuid(8)}`);

        await new ConditionalRevalidation(store).remember('k', null, 2);

        expect(store.writes).toEqual([]);
    });

    it('logs a failed write and still resolves', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = new FlakyStore(`validators-${uuid(8)}`);
        store.failWrites = true;

        await new ConditionalRevalidation(store).remember('k', '"v1"', 2);

        expect(warn).toHaveBeenCalledWith('[HttpSwrDbPlugin] could not store etag', { error: expect.any(Error) });
    });

    it('does not log a successful write', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = new FlakyStore(`validators-${uuid(8)}`);

        await new ConditionalRevalidation(store).remember('k', '"v1"', 2);

        expect(warn).not.toHaveBeenCalled();
    });
});
