import { describe, it, expect, afterEach } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { createRequestHandler, SerializedRequest } from '@routier/core/plugins';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { HttpTransportDbPlugin } from './HttpTransportDbPlugin';

/**
 * A store with NO database, talking to a store that has one.
 *
 * The client plugin holds a URL and nothing else. Every assertion below is really about one claim:
 * that a whole query — filters, sort, window, aggregates, a JOIN — can be expressed as JSON, rebuilt
 * on the far side against that side's own schemas, and executed there.
 *
 * The wire is real. Every request goes through `JSON.parse(JSON.stringify(...))` before the handler
 * sees it, so nothing passes by holding a reference that a socket would have dropped.
 */
const teamSchema = s.define('wire_teams', {
    _id: s.string().key().identity(),
    name: s.string(),
    region: s.string(),
    founded: s.date(),
}).compile();

const memberSchema = s.define('wire_members', {
    _id: s.string().key().identity(),
    teamId: s.string().nullable(),
    name: s.string(),
    rank: s.number(),
    deletedAt: s.date().nullable().default(() => null),
}).compile();

class WireStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    teams = this.collection(teamSchema).proxy().create();
    members = this.collection(memberSchema).softDelete(x => x.deletedAt).proxy().create();
}

const stores: DataStore[] = [];

/**
 * A client/server pair over one in-process "wire".
 *
 * `serverPlugin` is a real backend. `sent` records every payload, so a test can assert what actually
 * crossed rather than only what came back — which is the difference between "the answer is right"
 * and "the server did the work".
 */
const connected = (serverPlugin: IDbPlugin) => {
    const server = new WireStore(serverPlugin);
    stores.push(server);

    const handle = createRequestHandler({ plugin: serverPlugin, schemas: server.schemas });
    const sent: SerializedRequest[] = [];

    const client = new WireStore(new HttpTransportDbPlugin({
        url: 'https://api.test/routier',
        request: async (_url, body) => {
            // Through JSON both ways, so a Date or a class instance cannot sneak across by reference
            const overTheWire = JSON.parse(JSON.stringify(body)) as SerializedRequest;
            sent.push(overTheWire);

            return JSON.parse(JSON.stringify(await handle(overTheWire)));
        },
    }));
    stores.push(client);

    return { client, server, sent };
};

/** Seeded through the CLIENT, so the write path crosses the wire too. */
const seeded = async (serverPlugin: IDbPlugin) => {
    const connection = connected(serverPlugin);
    const { client } = connection;

    const [alpha, beta] = await client.teams.addAsync(
        { name: 'Alpha', region: 'east', founded: new Date('2001-01-01T00:00:00.000Z') },
        { name: 'Beta', region: 'west', founded: new Date('2002-02-02T00:00:00.000Z') },
        { name: 'Gamma', region: 'east', founded: new Date('2003-03-03T00:00:00.000Z') },
    );

    await client.saveChangesAsync();

    await client.members.addAsync(
        { teamId: alpha._id, name: 'Ann', rank: 10 },
        { teamId: alpha._id, name: 'Abe', rank: 20 },
        { teamId: beta._id, name: 'Bo', rank: 30 },
        { teamId: null, name: 'Nil', rank: 40 },
    );

    await client.saveChangesAsync();

    return { ...connection, alpha, beta };
};

describe('a plugin with no database', () => {

    afterEach(async () => {
        await Promise.all(stores.splice(0).map(store => store.destroyAsync().catch(() => undefined)));
    });

    describe('writes', () => {

        it('sends a save and returns the echo, including the identity the server assigned', async () => {
            const { client } = connected(new MemoryPlugin(uuidv4()));

            const [team] = await client.teams.addAsync({ name: 'Alpha', region: 'east', founded: new Date() });
            await client.saveChangesAsync();

            // The key was assigned by the server and came back through the echo. Without it the
            // change tracker could never match the row to the addition that produced it.
            expect(team._id).toBeTruthy();
            expect(await client.teams.countAsync()).toBe(1);
        });

        it('round-trips an update and a remove', async () => {
            const { client } = await seeded(new MemoryPlugin(uuidv4()));

            const ann = await client.members.firstAsync(m => m.name === 'Ann');
            ann.rank = 99;
            await client.saveChangesAsync();

            expect((await client.members.firstAsync(m => m.name === 'Ann')).rank).toBe(99);

            await client.members.removeAsync(ann);
            await client.saveChangesAsync();

            // Soft delete: the row is stamped, and the collection's scope hides it
            expect(await client.members.countAsync()).toBe(3);
        });

        it('makes no request when there is nothing to save', async () => {
            const { client, sent } = connected(new MemoryPlugin(uuidv4()));

            await client.saveChangesAsync();

            expect(sent).toHaveLength(0);
        });
    });

    describe('reads, with the work happening on the server', () => {

        it('sends a filter as an expression the server executes', async () => {
            const { client, sent } = await seeded(new MemoryPlugin(uuidv4()));
            sent.length = 0;

            const teams = await client.teams.where(t => t.region === 'east').toArrayAsync();

            expect(teams.map(t => t.name).sort()).toEqual(['Alpha', 'Gamma']);

            const request = sent[0];
            expect(request.kind).toBe('query');
            // The filter crossed as a tree, not as a pre-filtered result
            expect(JSON.stringify(request)).toContain('"comparator"');
        });

        it('sends sort and a window', async () => {
            const { client } = await seeded(new MemoryPlugin(uuidv4()));

            const members = await client.members.sort(m => m.rank).skip(1).take(2).toArrayAsync();

            expect(members.map(m => m.name)).toEqual(['Abe', 'Bo']);
        });

        it('returns an aggregate the server computed, not the rows', async () => {
            const { client, sent } = await seeded(new MemoryPlugin(uuidv4()));
            sent.length = 0;

            expect(await client.members.countAsync()).toBe(4);

            // `count` travelled, so the response is a number rather than four rows
            expect(JSON.stringify(sent[0])).toContain('"count"');
        });

        it('deserializes a Date back into a Date', async () => {
            const { client } = await seeded(new MemoryPlugin(uuidv4()));

            const alpha = await client.teams.firstAsync(t => t.name === 'Alpha');

            expect(alpha.founded).toBeInstanceOf(Date);
            expect(alpha.founded.toISOString()).toBe('2001-01-01T00:00:00.000Z');
        });

        /**
         * `map` is defined BY its closure, so it cannot cross. The prefix rule keeps everything from
         * it onward local, and the plugin runs it with the closure it still holds.
         */
        it('keeps a projection local and still returns the projected shape', async () => {
            const { client, sent } = await seeded(new MemoryPlugin(uuidv4()));
            sent.length = 0;

            const names = await client.members.where(m => m.rank > 15).map(m => m.name).toArrayAsync();

            expect(names.sort()).toEqual(['Abe', 'Bo', 'Nil']);

            // The filter went; the map did not
            const request = JSON.stringify(sent[0]);
            expect(request).toContain('"filter"');
            expect(request).not.toContain('"map"');
        });
    });

    /**
     * The point of sending the whole query rather than a URL per collection: the server can execute a
     * JOIN, and the client never sees the second collection's rows.
     */
    describe('joins, executed on the far side', () => {

        it('sends a join and gets pairs back', async () => {
            const { client, sent } = await seeded(new MemoryPlugin(uuidv4()));
            sent.length = 0;

            const pairs = await client.teams
                .join(s => s.members, t => t._id, m => m.teamId)
                .sort(([team, member]) => `${team.name}:${member.name}`)
                .map(([team, member]) => `${team.name}:${member.name}`)
                .toArrayAsync();

            expect(pairs).toEqual(['Alpha:Abe', 'Alpha:Ann', 'Beta:Bo']);

            // ONE request, carrying the join — not one per collection
            expect(sent).toHaveLength(1);
            const request = JSON.stringify(sent[0]);
            expect(request).toContain('"join"');
            expect(request).toContain('wire_members');
        });

        it('applies the inner side\'s soft-delete scope on the server', async () => {
            const { client } = await seeded(new MemoryPlugin(uuidv4()));

            await client.members.removeAsync(await client.members.firstAsync(m => m.name === 'Ann'));
            await client.saveChangesAsync();

            const pairs = await client.teams
                .join(s => s.members, t => t._id, m => m.teamId)
                .map(([team, member]) => `${team.name}:${member.name}`)
                .toArrayAsync();

            expect(pairs.sort()).toEqual(['Alpha:Abe', 'Beta:Bo']);
        });

        it('keeps unmatched rows on a left join', async () => {
            const { client } = await seeded(new MemoryPlugin(uuidv4()));

            const pairs = await client.teams
                .leftJoin(s => s.members, t => t._id, m => m.teamId)
                .map(([team, member]) => `${team.name}:${member?.name ?? '-'}`)
                .toArrayAsync();

            expect(pairs.sort()).toEqual(['Alpha:Abe', 'Alpha:Ann', 'Beta:Bo', 'Gamma:-']);
        });

        // A real SQL engine on the far side, so the forwarded join becomes an actual `JOIN`
        it('executes a forwarded join as native SQL when the server is SQLite', async () => {
            const { client } = await seeded(new SqliteDbPlugin(`wire-${uuidv4()}.sqlite`));

            const pairs = await client.teams
                .join(s => s.members, t => t._id, m => m.teamId)
                .where(([team]) => team.region === 'east')
                .map(([team, member]) => `${team.name}:${member.name}`)
                .toArrayAsync();

            expect(pairs.sort()).toEqual(['Alpha:Abe', 'Alpha:Ann']);
        });
    });

    describe('refusals', () => {

        it('reports a collection the endpoint does not serve', async () => {
            const other = s.define('wire_absent', { _id: s.string().key().identity(), name: s.string() }).compile();

            class NarrowStore extends DataStore {
                constructor(plugin: IDbPlugin) { super(plugin); }
                absent = this.collection(other).proxy().create();
            }

            const server = new WireStore(new MemoryPlugin(uuidv4()));
            stores.push(server);
            const handle = createRequestHandler({ plugin: server.getDbPlugin(), schemas: server.schemas });

            const client = new NarrowStore(new HttpTransportDbPlugin({
                url: 'https://api.test/routier',
                request: async (_url, body) => await handle(JSON.parse(JSON.stringify(body)) as SerializedRequest),
            }));
            stores.push(client);

            await expect(client.absent.toArrayAsync()).rejects.toThrow(/no collection named 'wire_absent'/);
        });

        // `destroy` means "release what this plugin holds", and this plugin holds a URL. Forwarding it
        // would let any client drop the server's database.
        it('does not forward destroy to the server', async () => {
            const { client, server, sent } = await seeded(new MemoryPlugin(uuidv4()));
            sent.length = 0;

            await client.destroyAsync();

            expect(sent).toHaveLength(0);
            expect(await server.teams.countAsync()).toBe(3);
        });
    });
});
