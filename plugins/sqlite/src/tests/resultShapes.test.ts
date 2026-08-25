import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '@routier/core/schema';
import { DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackResult } from '@routier/core/results';
import { DataStore } from '@routier/datastore';
import { buildTransferPlan, rawStorageTransferTypes, TransferEncoding } from '@routier/core/transfer';
import { ResultColumn } from '@routier/core/plugins';
import { SqliteDbPlugin } from '../index';
import { buildFromPersistOperation, buildFromQueryOperation, buildJoinQueryOperation } from '../utils';

/**
 * Which statements describe their result, and whether that description matches the statement
 * beside it.
 *
 * The load-bearing assertion here is `expectPlanMatchesSelectList`. A description in the wrong
 * order does not fail loudly — a consumer that encodes columnar would file every column's values
 * under another column's name — so the select list and the description are derived from ONE
 * ordered list, and this is what holds them there.
 */

const userSchema = s.define('plan_users', {
    id: s.number().key().identity(),
    name: s.string(),
    age: s.number(),
    active: s.boolean(),
    createdAt: s.date(),
    tags: s.array(s.string()),
}).compile();

const orderSchema = s.define('plan_orders', {
    id: s.string().key().identity(),
    userId: s.number(),
    total: s.number(),
}).compile();

class CapturingPlugin extends SqliteDbPlugin {

    constructor(private readonly onQuery: (event: DbPluginQueryEvent<any, any>) => void) {
        super(':memory:');
    }

    override query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        _: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        // Never completed: only the built operation matters, not a result.
        this.onQuery(event);
    }
}

class Store extends DataStore {
    users = this.collection(userSchema).proxy().create();
    orders = this.collection(orderSchema).proxy().create();
}

const stores: Store[] = [];

afterEach(() => {
    // A DataStore opens a BroadcastChannel pair per collection, and those hold the event loop open.
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

/** Captures the query operation a chained expression produces. */
const capture = (run: (store: Store) => void) => {
    let captured: any = null;
    const store = new Store(new CapturingPlugin(event => { captured = event.operation; }));

    stores.push(store);
    run(store);

    if (captured == null) {
        throw new Error('no query operation was captured');
    }

    return captured;
};

/** The columns of the OUTERMOST select list, as the statement names them. */
const selectedColumns = (sql: string): string[] => {
    const match = /^SELECT (?:DISTINCT )?(.+?) FROM /.exec(sql);

    if (match == null) {
        throw new Error(`could not read a select list out of: ${sql}`);
    }

    return match[1]
        .split(', ')
        .map(entry => {
            // A join projects `"o"."name" AS "o__name"`; the plan names the alias.
            const aliased = / AS "(.+)"$/.exec(entry);

            return aliased != null ? aliased[1] : entry.replace(/^"|"$/g, '');
        });
};

const expectPlanMatchesSelectList = (sql: string, result: readonly ResultColumn[] | undefined) => {
    expect(result).toBeDefined();
    expect(result?.map(column => column.name)).toEqual(selectedColumns(sql));
};

/**
 * The composition a worker-backed driver performs: take the statement's described result, apply
 * the mapping for what THIS engine returns, get a plan. The builder never does this itself.
 */
const encodingsOf = (result: readonly ResultColumn[] | undefined): Record<string, TransferEncoding> => {
    const plan = result == null ? undefined : buildTransferPlan(result, rawStorageTransferTypes);

    return Object.fromEntries((plan?.columns ?? []).map(column => [column.name, column.encoding]));
};

describe('entity SELECT', () => {

    it('describes a result that matches its select list', () => {
        const operation = buildFromQueryOperation(capture(store => store.users.toArray(jest.fn<any>())));

        expectPlanMatchesSelectList(operation.sql, operation.result);
        expect(encodingsOf(operation.result)).toEqual({
            id: 'float64',
            name: 'clone',
            age: 'float64',
            active: 'boolean-byte',
            createdAt: 'date-f64',
            tags: 'json',
        });
    });

    it('keeps the description through a filter and a sort, which do not touch the select list', () => {
        const operation = buildFromQueryOperation(capture(store =>
            store.users.where(x => x.age > 18).sort(x => x.name).toArray(jest.fn<any>())
        ));

        expectPlanMatchesSelectList(operation.sql, operation.result);
    });

    it('keeps the description through the subquery skip and take build', () => {
        const operation = buildFromQueryOperation(capture(store =>
            store.users.skip(5).take(10).toArray(jest.fn<any>())
        ));

        expect(operation.sql).toContain('subquery_1');
        expectPlanMatchesSelectList(operation.sql, operation.result);
    });
});

describe('distinct', () => {

    /**
     * `distinct` is NOT an aggregate here. It adds the keyword to the existing select list and
     * returns whole entity rows, which is exactly the shape the codec wins on. The aggregate
     * exclusion exists because a one-row one-number result costs more to encode than to clone.
     */
    it('describes its result, because it returns entity rows rather than one value', () => {
        const operation = buildFromQueryOperation(capture(store =>
            store.users.distinct(jest.fn<any>())
        ));

        expect(operation.sql).toContain('SELECT DISTINCT');
        expectPlanMatchesSelectList(operation.sql, operation.result);
    });
});

describe('aggregates', () => {

    it.each([
        ['count', (store: Store) => store.users.count(jest.fn<any>())],
        ['sum', (store: Store) => store.users.sum(x => x.age, jest.fn<any>())],
        ['min', (store: Store) => store.users.min(x => x.age, jest.fn<any>())],
        ['max', (store: Store) => store.users.max(x => x.age, jest.fn<any>())],
    ])('describes no result for %s, which replaces the select list with one value', (_, run) => {
        const operation = buildFromQueryOperation(capture(run));

        expect(operation.result).toBeUndefined();
    });
});

describe('projections', () => {

    it('describes the columns the projection actually selects, in that order', () => {
        const operation = buildFromQueryOperation(capture(store =>
            store.users.map(x => ({ when: x.createdAt, howOld: x.age })).toArray(jest.fn<any>())
        ));

        expectPlanMatchesSelectList(operation.sql, operation.result);
        expect(encodingsOf(operation.result)).toEqual({ createdAt: 'date-f64', age: 'float64' });
    });

    it('describes a single-column projection', () => {
        const operation = buildFromQueryOperation(capture(store =>
            store.users.map(x => x.name).toArray(jest.fn<any>())
        ));

        expectPlanMatchesSelectList(operation.sql, operation.result);
        expect(encodingsOf(operation.result)).toEqual({ name: 'clone' });
    });
});

describe('joins', () => {

    it('describes the flat joined row under the aliases the projection emits', () => {
        const captured = capture(store =>
            store.users.join(t => t.orders, u => u.id, o => o.userId).toArray(jest.fn<any>())
        );

        const operation = buildJoinQueryOperation(captured, orderSchema as any);

        expectPlanMatchesSelectList(operation.sql, operation.result);
        expect(encodingsOf(operation.result)).toEqual({
            o__id: 'float64',
            o__name: 'clone',
            o__age: 'float64',
            o__active: 'boolean-byte',
            o__createdAt: 'date-f64',
            o__tags: 'json',
            i__id: 'clone',
            i__userId: 'float64',
            i__total: 'float64',
        });
    });

    /**
     * Both sides carry `id`, and the aliases are what stop one overwriting the other. Without
     * them the plan would name `id` twice and be declined outright.
     */
    it('keeps the two sides apart even though both declare id', () => {
        const captured = capture(store =>
            store.users.leftJoin(t => t.orders, u => u.id, o => o.userId).toArray(jest.fn<any>())
        );

        const operation = buildJoinQueryOperation(captured, orderSchema as any);
        const names = operation.result?.map(column => column.name) ?? [];

        expect(new Set(names).size).toBe(names.length);
        expect(names).toContain('o__id');
        expect(names).toContain('i__id');
    });
});

describe('writes that RETURN rows', () => {

    const changes = (over: Record<string, unknown>) => ({
        adds: [],
        updates: [],
        removes: [],
        hasItems: true,
        ...over,
    }) as any;

    const entity = { id: 1, name: 'ada', age: 36, active: 1, createdAt: '2026-08-25T00:00:00.000Z', tags: [] as string[] };

    const fullRowEncodings = {
        id: 'float64',
        name: 'clone',
        age: 'float64',
        active: 'boolean-byte',
        createdAt: 'date-f64',
        tags: 'json',
    };

    it('describes the row an INSERT returns', () => {
        const operations = buildFromPersistOperation(userSchema as any, changes({ adds: [entity] }));

        expect(operations.adds?.sql).toContain('RETURNING');
        expectPlanMatchesSelectList(`SELECT ${operations.adds!.sql.split('RETURNING ')[1]} FROM x`, operations.adds?.result);
        expect(encodingsOf(operations.adds?.result)).toEqual(fullRowEncodings);
    });

    it('describes the row an UPDATE returns', () => {
        const operations = buildFromPersistOperation(userSchema as any, changes({
            updates: [{ entity, delta: { name: 'grace' } }],
        }));

        expect(operations.updates).toHaveLength(1);
        expect(encodingsOf(operations.updates[0].result)).toEqual(fullRowEncodings);
    });

    it('describes the row a DELETE returns', () => {
        const operations = buildFromPersistOperation(userSchema as any, changes({ removes: [entity] }));

        expect(encodingsOf(operations.removes?.result)).toEqual(fullRowEncodings);
    });

    /** A token check switches to one conditional statement per row, and must not lose the plan. */
    it('describes a token-checked UPDATE, which takes the conditional statement form', () => {
        const operations = buildFromPersistOperation(userSchema as any, changes({
            updates: [{
                entity,
                delta: { name: 'grace' },
                concurrency: { column: '__version', expected: 1 },
            }],
        }));

        expect(operations.updates).toHaveLength(1);
        expect(operations.updates[0].conflictCheck).toBeDefined();
        expect(encodingsOf(operations.updates[0].result)).toEqual(fullRowEncodings);
    });
});
