import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { PostgresDbPluginBase } from '../plugin';
import type { PostgresConnection, PostgresDriver } from '../drivers/types';

const items = s.define('race_items', { id: s.string().key(), name: s.string() }).compile();

class Store extends DataStore {
    items = this.collection(items).proxy().create();
}

type SqlError = Error & { code: string };

const sqlError = (code: string, message: string): SqlError => Object.assign(new Error(message), { code });

const LOST_RACE: [string, SqlError][] = [
    ['the row type already exists (42710)', sqlError('42710', 'type "race_items" already exists')],
    ['the relation already exists (42P07)', sqlError('42P07', 'relation "race_items" already exists')],
    ['the catalog row is a duplicate (23505)', sqlError('23505', 'duplicate key value violates unique constraint "pg_type_typname_nsp_index"')],
];

const racingDriver = (createFailure: Error) => {
    let tableExists = false;
    const statements: string[] = [];

    const connection: PostgresConnection = {
        all: async (sql, params) => {
            statements.push(sql);

            if (!tableExists) {
                throw sqlError('42P01', 'relation "race_items" does not exist');
            }

            return sql.startsWith('INSERT') ? [{ id: params?.[0], name: params?.[1] }] : [];
        },
        run: async sql => {
            statements.push(sql);

            if (sql.startsWith('CREATE TABLE')) {
                tableExists = true;
                throw createFailure;
            }
        },
        release: async (): Promise<void> => undefined,
    };

    const driver: PostgresDriver = {
        name: 'racing',
        databaseName: 'race',
        connect: async () => connection,
        destroy: async (): Promise<void> => undefined,
    };

    return { driver, statements };
};

const stores: Store[] = [];

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const open = (driver: PostgresDriver): Store => {
    const store = new Store(new PostgresDbPluginBase(driver));
    stores.push(store);
    return store;
};

describe('losing the race to create a table', () => {
    it.each(LOST_RACE)('lets a query carry on when %s', async (_label, failure) => {
        const { driver } = racingDriver(failure);

        expect(await open(driver).items.toArrayAsync()).toEqual([]);
    });

    it.each(LOST_RACE)('lets a save carry on when %s', async (_label, failure) => {
        const { driver, statements } = racingDriver(failure);
        const store = open(driver);

        await store.items.addAsync({ id: 'a', name: 'first' });
        await store.saveChangesAsync();

        expect(statements.filter(sql => sql.startsWith('INSERT'))).toHaveLength(2);
        expect(statements).toContain('COMMIT');
    });

    it.each([
        ['a query', (store: Store) => store.items.toArrayAsync()],
        ['a save', async (store: Store) => { await store.items.addAsync({ id: 'a', name: 'x' }); await store.saveChangesAsync(); }],
    ])('still fails %s when the create fails for another reason', async (_label, work) => {
        const { driver } = racingDriver(sqlError('42501', 'permission denied for schema public'));

        await expect(work(open(driver))).rejects.toThrow('permission denied');
    });
});
