import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { createRequestHandler, SerializedRequest, SerializedResponse } from '@routier/core/plugins';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { HttpTransportDbPlugin } from './HttpTransportDbPlugin';

/**
 * End to end over real HTTP — the same tier as `httpServer.e2e.test.ts`, for the transport plugin.
 *
 * Everything else about this plugin has been tested through an in-process function standing in for
 * the network. That proves the wire FORMAT. It cannot prove the wire: sockets, real `fetch`, JSON
 * framing, status codes, and headers all get a say here, and the client is a store with no database
 * of any kind.
 *
 * The server is a real `node:http` listener with `createRequestHandler` mounted on a route, backed by
 * a real SQLite file — so a filter sent from the client becomes a `WHERE` clause on disk, and a join
 * becomes an actual SQL `JOIN`. Which is the whole claim.
 *
 * Not Playwright: this plugin's only platform dependencies are `fetch` and `JSON`, so a browser adds
 * no behaviour a socket does not already exercise. A browser test would be proving a bundler works,
 * which is a different question from whether the protocol does.
 */
const teamSchema = s.define('e2e_wire_teams', {
    _id: s.string().key().identity(),
    tenantId: s.string(),
    name: s.string(),
    founded: s.date(),
}).compile();

const memberSchema = s.define('e2e_wire_members', {
    _id: s.string().key().identity(),
    teamId: s.string().nullable(),
    tenantId: s.string(),
    name: s.string(),
    rank: s.number(),
}).compile();

class Store extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    teams = this.collection(teamSchema).proxy().create();
    members = this.collection(memberSchema).proxy().create();
}

type Context = { tenantId: string | null };

/** Reads a whole request body. A payload arrives in as many chunks as the socket feels like. */
const readBody = (request: http.IncomingMessage) => new Promise<string>((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
});

describe('the transport plugin over real HTTP', () => {

    let server: http.Server;
    let url: string;
    let serverStore: Store;
    /** Every payload the server actually received, for asserting what crossed rather than what returned. */
    const received: SerializedRequest[] = [];
    const opened: DataStore[] = [];

    beforeAll(async () => {
        // A real database on disk behind the endpoint, so a forwarded filter becomes SQL
        serverStore = new Store(new SqliteDbPlugin(`e2e-wire-${uuidv4()}.sqlite`));

        /**
         * The context is built from the REQUEST — a header, here — and never from the body. The body
         * is the part the client controls, so trusting a tenant id out of it would let any caller
         * claim any tenant.
         */
        const handle = createRequestHandler<Context>({
            plugin: serverStore.getDbPlugin(),
            schemas: serverStore.schemas,
            authorize: ({ context }) => context.tenantId != null || 'not signed in',
            scope: ({ context }) => ({
                filter: ([row, p]: [any, any]) => row.tenantId === p.tenantId,
                params: { tenantId: context.tenantId },
            }),
        });

        server = http.createServer(async (request, response) => {
            if (request.method !== 'POST' || request.url !== '/routier') {
                response.writeHead(404).end();
                return;
            }

            try {
                const body = JSON.parse(await readBody(request)) as SerializedRequest;
                received.push(body);

                const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? null;
                const answer: SerializedResponse = await handle(body, { tenantId: bearer });

                // A refusal is a value, so the route decides the status. 403 for a policy refusal is
                // the caller's choice, not the handler's.
                response
                    .writeHead(answer.ok ? 200 : 403, { 'Content-Type': 'application/json' })
                    .end(JSON.stringify(answer));
            } catch (error) {
                response
                    .writeHead(500, { 'Content-Type': 'application/json' })
                    .end(JSON.stringify({ ok: false, error: String(error) }));
            }
        });

        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/routier`;

        // Seeded directly on the server, so the rows the scope must hide genuinely exist
        const [alpha, beta] = await serverStore.teams.addAsync(
            { tenantId: 'acme', name: 'Alpha', founded: new Date('2001-01-01T00:00:00.000Z') },
            { tenantId: 'acme', name: 'Beta', founded: new Date('2002-02-02T00:00:00.000Z') },
            { tenantId: 'other', name: 'Hidden', founded: new Date('2003-03-03T00:00:00.000Z') },
        );
        await serverStore.saveChangesAsync();

        await serverStore.members.addAsync(
            { teamId: alpha._id, tenantId: 'acme', name: 'Ann', rank: 10 },
            { teamId: alpha._id, tenantId: 'acme', name: 'Abe', rank: 20 },
            { teamId: beta._id, tenantId: 'acme', name: 'Bo', rank: 30 },
            { teamId: null, tenantId: 'other', name: 'Nobody', rank: 40 },
        );
        await serverStore.saveChangesAsync();
    }, 60_000);

    afterAll(async () => {
        await Promise.all(opened.splice(0).map(store => store.destroyAsync().catch(() => undefined)));
        await serverStore?.destroyAsync().catch(() => undefined);
        await new Promise<void>(resolve => server?.close(() => resolve()));
    });

    afterEach(async () => {
        await Promise.all(opened.splice(0).map(store => store.destroyAsync().catch(() => undefined)));
    });

    /** A client with no database, using the platform's own fetch — no `request` override. */
    const client = (token: string | null) => {
        const store = new Store(new HttpTransportDbPlugin({
            url,
            getHeaders: (): Record<string, string> => token == null ? {} : { Authorization: `Bearer ${token}` },
        }));
        opened.push(store);
        return store;
    };

    it('reads over a socket, scoped to the caller in the header', async () => {
        const teams = await client('acme').teams.toArrayAsync();

        // "Hidden" belongs to another tenant and never leaves the server
        expect(teams.map(t => t.name).sort()).toEqual(['Alpha', 'Beta']);
    });

    it('sends a filter as an expression, and the server turns it into SQL', async () => {
        received.length = 0;

        const teams = await client('acme').teams.where(t => t.name === 'Beta').toArrayAsync();

        expect(teams.map(t => t.name)).toEqual(['Beta']);

        // The tree crossed; the rows were not filtered on this side
        const payload = JSON.stringify(received.at(-1));
        expect(payload).toContain('"comparator"');
        expect(payload).toContain('"Beta"');
    });

    it('returns an aggregate the server computed', async () => {
        received.length = 0;

        expect(await client('acme').members.countAsync()).toBe(3);

        expect(JSON.stringify(received.at(-1))).toContain('"count"');
    });

    it('brings a Date back as a Date', async () => {
        const alpha = await client('acme').teams.firstAsync(t => t.name === 'Alpha');

        expect(alpha.founded).toBeInstanceOf(Date);
        expect(alpha.founded.toISOString()).toBe('2001-01-01T00:00:00.000Z');
    });

    /**
     * The claim the whole exercise was for: one request carries a join, and a real SQL engine on the
     * other side executes it. The client never receives the members collection.
     */
    it('sends a join in ONE request and gets pairs back from real SQL', async () => {
        received.length = 0;

        const pairs = await client('acme').teams
            .join(s => s.members, t => t._id, m => m.teamId)
            .sort(([team, member]) => `${team.name}:${member.name}`)
            .map(([team, member]) => `${team.name}:${member.name}`)
            .toArrayAsync();

        expect(pairs).toEqual(['Alpha:Abe', 'Alpha:Ann', 'Beta:Bo']);

        expect(received).toHaveLength(1);
        const payload = JSON.stringify(received[0]);
        expect(payload).toContain('"join"');
        expect(payload).toContain('e2e_wire_members');
    });

    it('scopes the inner side of a join too', async () => {
        const pairs = await client('acme').teams
            .leftJoin(s => s.members, t => t._id, m => m.teamId)
            .map(([team, member]) => `${team.name}:${member?.name ?? '-'}`)
            .toArrayAsync();

        // Nothing from the other tenant on either side
        expect(pairs.sort()).toEqual(['Alpha:Abe', 'Alpha:Ann', 'Beta:Bo']);
    });

    it('writes over the socket and gets the assigned identity back', async () => {
        const store = client('acme');

        const [team] = await store.teams.addAsync({ tenantId: 'acme', name: 'Delta', founded: new Date() });
        await store.saveChangesAsync();

        // Assigned by SQLite, returned in the echo
        expect(team._id).toBeTruthy();

        const found = await store.teams.firstOrUndefinedAsync(t => t.name === 'Delta');
        expect(found?._id).toBe(team._id);

        await store.teams.removeAsync(found!);
        await store.saveChangesAsync();
    });

    it('refuses a write outside the caller\'s scope', async () => {
        const store = client('acme');

        await store.teams.addAsync({ tenantId: 'other', name: 'Smuggled', founded: new Date() });

        await expect(store.saveChangesAsync()).rejects.toThrow(/falls outside the scope/);

        // And nothing landed
        expect(await serverStore.teams.someAsync(t => t.name === 'Smuggled')).toBe(false);
    });

    it('surfaces a policy refusal from the server, status and all', async () => {
        // No header, so the route builds a context with no tenant and `authorize` refuses
        await expect(client(null).teams.toArrayAsync()).rejects.toThrow(/not signed in/);
    });

    it('reports a transport failure as a transport failure', async () => {
        const wrongRoute = new Store(new HttpTransportDbPlugin({
            url: url.replace('/routier', '/nope'),
            getHeaders: () => ({ Authorization: 'Bearer acme' }),
        }));
        opened.push(wrongRoute);

        // A 404 is not a rejected query, and flattening the two would hide a misconfigured route
        await expect(wrongRoute.teams.toArrayAsync()).rejects.toThrow(/returned 404/);
    });

    it('reports a refused connection rather than hanging', async () => {
        const unreachable = new Store(new HttpTransportDbPlugin({
            // Port 1 is privileged and nothing listens on it
            url: 'http://127.0.0.1:1/routier',
        }));
        opened.push(unreachable);

        await expect(unreachable.teams.toArrayAsync()).rejects.toThrow();
    });
});
