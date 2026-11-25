import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '@routier/core/schema';
import { resetLogLevel, setLogLevel, uuid } from '@routier/core/utilities';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import { installFetchMock, waitFor } from './__tests__/httpTestKit';
import { inspect } from 'node:util';

const schema = s.define('swrSensitive', {
    id: s.string().key(),
    name: s.string(),
    ssn: s.string().sensitive(),
}).compile();

class Store extends DataStore {
    people = this.collection(schema).proxy().create();
}

describe('HttpSwrDbPlugin debug logging', () => {
    let http: ReturnType<typeof installFetchMock>;
    let serverRows: Record<string, unknown>[];
    let logged: string[];

    beforeEach(() => {
        logged = [];
        http = installFetchMock();
        serverRows = [{ id: 'a', name: 'Ada', ssn: '123-45-6789' }];
        http.respondToGet(() => ({ status: 200, body: serverRows }));

        for (const method of ['debug', 'info', 'warn', 'error', 'log'] as const) {
            jest.spyOn(console, method).mockImplementation((...args) => {
                logged.push(args.map(arg => typeof arg === 'string' ? arg : inspect(arg, { depth: 20 })).join(' '));
            });
        }

        setLogLevel('debug');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        resetLogLevel();
    });

    const store = () => new Store(new HttpSwrDbPlugin(new MemoryPlugin(`swr-${uuid(8)}`), {
        getUrl: collection => `https://api.test/${collection}`,
        unsyncedQueueStore: new MemoryPlugin(`queue-${uuid(8)}`),
        maxAgeMs: 0,
    }));

    it('hides sensitive values in the rows it logs while revalidating', async () => {
        const dataStore = store();
        await dataStore.people.toArrayAsync();

        serverRows = [{ id: 'a', name: 'Ada Lovelace', ssn: '123-45-6789' }, { id: 'b', name: 'Grace', ssn: '987-65-4321' }];
        const gets = http.gets.length;
        await dataStore.people.toArrayAsync();
        await waitFor(() => http.gets.length > gets, 'the revalidation');
        await waitFor(async () => (await dataStore.people.toArrayAsync()).length === 2, 'the revalidated rows');

        const output = logged.join('\n');

        expect(output).toContain('Grace');
        expect(output).not.toContain('123-45-6789');
        expect(output).not.toContain('987-65-4321');
    });

    it('hides sensitive values in the rows it logs while saving', async () => {
        const dataStore = store();
        await dataStore.people.addAsync({ id: 'c', name: 'Hedy', ssn: '555-55-5555' });
        await dataStore.saveChangesAsync();

        expect(logged.join('\n')).not.toContain('555-55-5555');
    });
});
