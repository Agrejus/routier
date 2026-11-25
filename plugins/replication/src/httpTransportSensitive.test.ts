import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { createRequestHandler, type SerializedRequest } from '@routier/core/plugins';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { HttpTransportDbPlugin } from './HttpTransportDbPlugin';

const personSchema = s.define('wire_people', {
    id: s.string().key(),
    name: s.string(),
    ssn: s.string().sensitive(),
}).compile();

class Store extends DataStore {
    people = this.collection(personSchema).proxy().create();
}

const stores: Store[] = [];

afterEach(() => {
    responses.splice(0);

    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const responses: string[] = [];

const connected = async () => {
    const serverPlugin = new SqliteDbPlugin(':memory:');
    const server = new Store(serverPlugin);
    const handle = createRequestHandler({ plugin: serverPlugin, schemas: server.schemas });
    const client = new Store(new HttpTransportDbPlugin({
        url: `https://api.test/${uuidv4()}`,
        request: async (_url, body) => {
            const response = JSON.stringify(await handle(JSON.parse(JSON.stringify(body)) as SerializedRequest));

            responses.push(response);

            return JSON.parse(response);
        },
    }));

    stores.push(server, client);
    await client.people.addAsync({ id: 'p1', name: 'Ada', ssn: '123-45-6789' });
    await client.saveChangesAsync();

    return client;
};

describe('the executed queries a server sends back for .explain()', () => {
    it('hide the parameters of a filter on a sensitive property', async () => {
        const client = await connected();
        const { data, explanation } = await client.people.where(p => p.ssn === '123-45-6789').explain().toArrayAsync();

        expect(data.map(row => row.id)).toEqual(['p1']);
        expect(JSON.stringify(explanation)).not.toContain('123-45-6789');
        expect(responses.at(-1)).toContain('executedQueries');
        expect(responses.at(-1)).toContain('[redacted]');
    });

    it('keep the parameters of a filter on another property', async () => {
        const client = await connected();
        const { explanation } = await client.people.where(p => p.name === 'Ada').explain().toArrayAsync();

        expect(JSON.stringify(explanation)).toContain('Ada');
    });
});
