import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '@routier/core';
import type { DbPluginQueryEvent, IQuery, ITranslatedValue } from '@routier/core/plugins';
import type { PluginEventCallbackResult } from '@routier/core/results';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '../index';
import { SQL_FRAME_CACHE_MAX, SqlFrameCache, type SqlCacheMode } from '../queryCache';
import type { SqlOperation } from '../types';
import { buildFromQueryOperation } from '../utils';

const people = s.define('frame_unit_people', { id: s.string().key(), name: s.string(), age: s.number() }).compile();
const pets = s.define('frame_unit_pets', { id: s.string().key(), name: s.string(), age: s.number() }).compile();

type Captured = { through(cache: SqlFrameCache): SqlOperation; fresh(): SqlOperation };

class CapturingPlugin extends SqliteDbPlugin {
    readonly queries: Captured[] = [];

    override query<TRoot extends {}, TShape = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, _done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.queries.push({
            through: cache => cache.operationFor(event.operation),
            fresh: () => buildFromQueryOperation(event.operation),
        });
    }
}

class Store extends DataStore {
    people = this.collection(people).proxy().create();
    pets = this.collection(pets).proxy().create();
}

const stores: Store[] = [];

afterEach(() => {
    jest.restoreAllMocks();

    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const capture = (issue: (store: Store) => void): Captured[] => {
    const plugin = new CapturingPlugin('unused.sqlite');
    const store = new Store(plugin);
    stores.push(store);
    issue(store);
    return plugin.queries;
};

const byName = (store: Store, name: string): void => {
    void store.people.where(([x, p]) => x.name === p.name && x.age > p.min, { name, min: 1 }).take(3).toArrayAsync();
};

const [ada, bob, nulled] = capture(store => {
    byName(store, 'Ada');
    byName(store, 'Bob');
    void store.people.where(([x, p]) => x.name === p.name && x.age > p.min, { name: null, min: 1 }).take(3).toArrayAsync();
});

const chained = capture(store => {
    for (const name of ['Ada', 'Bob']) {
        void store.people.where(([x, p]) => x.name === p.name, { name }).where(([x, p]) => x.age > p.min, { min: 1 }).toArrayAsync();
    }
});

const partlyRendered = capture(store => {
    for (const min of [1, 2]) {
        void store.people.where(([x, p]) => x.age > p.min, { min }).where(x => x.age ** 2 > 900).toArrayAsync();
    }
});

const [unfiltered] = capture(store => {
    void store.people.take(3).toArrayAsync();
});

const [petByName] = capture(store => {
    void store.pets.where(([x, p]) => x.name === p.name, { name: 'Rex' }).take(3).toArrayAsync();
});

const takes = capture(store => {
    for (let i = 0; i <= SQL_FRAME_CACHE_MAX; i++) {
        void store.people.where(([x, p]) => x.name === p.name, { name: `n${i}` }).take(i + 1).toArrayAsync();
    }
});

const queriesExist = (...queries: (Captured | undefined)[]): Captured[] =>
    queries.map(query => {
        if (query == null) {
            throw new Error('A query was not captured');
        }

        return query;
    });

type Altered = (operation: SqlOperation) => SqlOperation;

const counting = (alter: Altered = operation => operation) => {
    let calls = 0;
    const alterations: Altered[] = [];

    const build = <TEntity extends {}, TShape>(query: IQuery<TEntity, TShape>): SqlOperation => {
        calls++;
        const fresh = buildFromQueryOperation(query);
        return (alterations.shift() ?? alter)(fresh);
    };

    return { build, calls: () => calls, nextBuild: (next: Altered) => alterations.push(next) };
};

describe('SqlFrameCache', () => {
    it('builds every query fresh when off', () => {
        const [first, second] = queriesExist(ada, bob);
        const builder = counting();
        const cache = new SqlFrameCache('off', builder.build);

        first.through(cache);
        second.through(cache);

        expect(builder.calls()).toBe(2);
    });

    it('reuses the frame for a second query of the same shape when on', () => {
        const [first, second] = queriesExist(ada, bob);
        const builder = counting();
        const cache = new SqlFrameCache('on', builder.build);

        first.through(cache);
        const reused = second.through(cache);

        expect(builder.calls()).toBe(1);
        expect(reused).toEqual(second.fresh());
    });

    it('fills a frame learned from a query with no filter', () => {
        const [query] = queriesExist(unfiltered);
        const builder = counting();
        const cache = new SqlFrameCache('on', builder.build);

        query.through(cache);

        expect(query.through(cache)).toEqual(query.fresh());
        expect(builder.calls()).toBe(1);
    });

    it('renders a null filter fresh into a reused frame', () => {
        const [first, other] = queriesExist(ada, nulled);
        const builder = counting();
        const cache = new SqlFrameCache('on', builder.build);

        first.through(cache);
        const operation = other.through(cache);

        expect(operation).toEqual(other.fresh());
        expect(operation.sql).toContain('IS NULL');
        expect(builder.calls()).toBe(1);
    });

    it('keeps frames per schema', () => {
        const [person, pet] = queriesExist(ada, petByName);
        const builder = counting();
        const cache = new SqlFrameCache('on', builder.build);

        person.through(cache);
        const operation = pet.through(cache);

        expect(operation.sql).toContain('frame_unit_pets');
        expect(builder.calls()).toBe(2);
    });

    it('returns the fresh build and keeps quiet in shadow mode when the frame agrees', () => {
        const [first, second] = queriesExist(ada, bob);
        const warn = jest.spyOn(logger, 'warn');
        const builder = counting();
        const cache = new SqlFrameCache('shadow', builder.build);

        first.through(cache);
        const operation = second.through(cache);

        expect(operation).toEqual(second.fresh());
        expect(builder.calls()).toBe(2);
        expect(warn).not.toHaveBeenCalled();
    });

    it.each<[string, Altered]>([
        ['the statement', operation => ({ ...operation, sql: `${operation.sql} ` })],
        ['the last param', operation => ({ ...operation, params: [...operation.params.slice(0, -1), 'other'] })],
        ['the param count', operation => ({ ...operation, params: [...operation.params, 'extra'] })],
        ['the last result column name', operation => ({ ...operation, result: operation.result?.map((column, i, all) => i === all.length - 1 ? { ...column, name: 'other' } : column) })],
        ['the last result column property', operation => ({ ...operation, result: operation.result?.map((column, i, all) => i === all.length - 1 ? { name: column.name } : column) })],
        ['a fresh result with fewer columns', operation => ({ ...operation, result: operation.result?.slice(1) })],
        ['a fresh result with more columns', operation => ({ ...operation, result: [...operation.result ?? [], { name: 'extra' }] })],
        ['a missing result', ({ result: _result, ...operation }) => operation],
    ])('warns, returns the fresh build and forgets the frame in shadow mode when %s differs', (_label, alter) => {
        const [first, second] = queriesExist(ada, bob);
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const builder = counting();
        const cache = new SqlFrameCache('shadow', builder.build);

        first.through(cache);
        builder.nextBuild(alter);
        const operation = second.through(cache);

        expect(operation).toEqual(alter(second.fresh()));
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain('SQL frame cache mismatch');

        second.through(cache);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(builder.calls()).toBe(3);
    });

    it('warns when only the cached frame is missing its result', () => {
        const [first, second] = queriesExist(ada, bob);
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const builder = counting();
        const cache = new SqlFrameCache('shadow', builder.build);

        builder.nextBuild(({ result: _result, ...operation }) => operation);
        first.through(cache);
        second.through(cache);

        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('reuses a frame for several filters joined with AND', () => {
        const [first, second] = queriesExist(...chained);
        const builder = counting();
        const cache = new SqlFrameCache('on', builder.build);

        first.through(cache);
        const operation = second.through(cache);

        expect(operation).toEqual(second.fresh());
        expect(operation.sql).toContain(' AND ');
        expect(builder.calls()).toBe(1);
    });

    it('reuses a frame that leaves out a filter the database cannot render', () => {
        const [first, second] = queriesExist(...partlyRendered);
        const builder = counting();
        const cache = new SqlFrameCache('on', builder.build);

        first.through(cache);
        const operation = second.through(cache);

        expect(operation).toEqual(second.fresh());
        expect(builder.calls()).toBe(1);
    });

    it('never compares when off', () => {
        const [first, second] = queriesExist(ada, bob);
        const warn = jest.spyOn(logger, 'warn');
        const builder = counting();
        const cache = new SqlFrameCache('off', builder.build);

        first.through(cache);
        builder.nextBuild(operation => ({ ...operation, sql: `${operation.sql} ` }));
        second.through(cache);

        expect(warn).not.toHaveBeenCalled();
    });

    it('accepts a cached and fresh result that are both missing', () => {
        const [first, second] = queriesExist(ada, bob);
        const warn = jest.spyOn(logger, 'warn');
        const builder = counting(({ result: _result, ...operation }) => operation);
        const cache = new SqlFrameCache('shadow', builder.build);

        first.through(cache);
        second.through(cache);

        expect(warn).not.toHaveBeenCalled();
    });

    it('does not cache a build whose statement does not contain its filter', () => {
        const [first, second] = queriesExist(ada, bob);
        const builder = counting(operation => ({ ...operation, sql: 'SELECT 1' }));
        const cache = new SqlFrameCache('on', builder.build);

        first.through(cache);
        second.through(cache);

        expect(builder.calls()).toBe(2);
    });

    it('evicts the least recently learned frame past the limit', () => {
        const [oldest, secondOldest, newest] = queriesExist(takes[0], takes[1], takes[SQL_FRAME_CACHE_MAX]);
        const builder = counting();
        const cache = new SqlFrameCache('on', builder.build);

        for (const query of queriesExist(...takes)) {
            query.through(cache);
        }

        newest.through(cache);
        secondOldest.through(cache);
        expect(builder.calls()).toBe(SQL_FRAME_CACHE_MAX + 1);

        oldest.through(cache);
        expect(builder.calls()).toBe(SQL_FRAME_CACHE_MAX + 2);
    });

    it.each<SqlCacheMode>(['on', 'shadow'])('defaults to the real builder in %s mode', mode => {
        const [query] = queriesExist(ada);

        expect(query.through(new SqlFrameCache(mode))).toEqual(query.fresh());
    });
});
