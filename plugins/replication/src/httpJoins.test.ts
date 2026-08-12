import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { s } from '@routier/core/schema';
import { DataStore, DataStoreOptions } from '@routier/datastore';
import { HttpDbPlugin } from './HttpDbPlugin';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';

/**
 * Joins over HTTP — interpretation 3 from `specs/joins.md`.
 *
 * No server knows what a join is. Each side goes out as the plain collection query it would have
 * been, and the pairing happens in the plugin. The assertions below are therefore as much about
 * what is REQUESTED as about what comes back: two ordinary GETs, one per collection, with the join
 * appearing nowhere on the wire.
 */

const teamSchema = s.define('http_join_teams', {
    id: s.string().key(),
    name: s.string(),
}).compile();

const memberSchema = s.define('http_join_members', {
    id: s.string().key(),
    teamId: s.string().nullable(),
    name: s.string(),
}).compile();

class JoinStore extends DataStore {
    constructor(plugin: IDbPlugin, options?: DataStoreOptions) {
        super(plugin, options);
    }

    teams = this.collection(teamSchema).proxy().create();
    members = this.collection(memberSchema).proxy().create();
}

const TEAMS = [
    { id: 'team-a', name: 'Alpha' },
    { id: 'team-b', name: 'Beta' },
    { id: 'team-c', name: 'Gamma' },
];

const MEMBERS = [
    { id: 'm-a1', teamId: 'team-a', name: 'Ann' },
    { id: 'm-a2', teamId: 'team-a', name: 'Abe' },
    { id: 'm-b1', teamId: 'team-b', name: 'Bo' },
    { id: 'm-null', teamId: null, name: 'Nil' },
];

/** Serves each collection from its URL, and records every request for inspection. */
const installFetchMock = () => {
    const urls: string[] = [];

    global.fetch = jest.fn(async (url: unknown) => {
        const asString = String(url);
        urls.push(asString);

        const body = asString.includes('http_join_teams') ? TEAMS : MEMBERS;

        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => body,
        };
    }) as unknown as typeof fetch;

    return urls;
};

const originalFetch = global.fetch;

describe('joins over HTTP', () => {

    let urls: string[];

    beforeEach(() => {
        urls = installFetchMock();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const store = () => new JoinStore(new HttpDbPlugin({
        getUrl: (collection) => `https://api.test/${collection}`,
    }));

    it('pairs rows fetched from two ordinary collection requests', async () => {
        const pairs = await store().teams
            .join(s => s.members, t => t.id, m => m.teamId)
            .sort(([team, member]) => `${team.name}:${member.name}`)
            .map(([team, member]) => `${team.name}:${member.name}`)
            .toArrayAsync();

        expect(pairs).toEqual(['Alpha:Abe', 'Alpha:Ann', 'Beta:Bo']);
    });

    it('requests each collection once, and sends nothing about the join', async () => {
        await store().teams
            .join(s => s.members, t => t.id, m => m.teamId)
            .toArrayAsync();

        expect(urls).toHaveLength(2);
        expect(urls.some(url => url.includes('http_join_teams'))).toBe(true);
        expect(urls.some(url => url.includes('http_join_members'))).toBe(true);

        // Nothing about the join reaches the query string. Checked on the PARAMS rather than the
        // whole URL, because these collections are called `http_join_*` and a substring test on
        // the URL passes for the wrong reason.
        for (const url of urls) {
            const params = [...new URL(url).searchParams.keys()];

            expect(params).not.toContain('join');
            expect(params).not.toContain('innerSchemaId');
        }
    });

    /**
     * The semi-join prefilter, seen from the wire.
     *
     * The outer request goes out first; its keys become an `IN`-style filter on the inner request,
     * so the server is asked only for members that can actually pair. Above
     * `semiJoinKeyThreshold` the prefilter is abandoned and the inner request carries no filter —
     * both give the same pairs, which is what makes it a cost knob rather than a behaviour.
     */
    it('narrows the inner request to the outer keys, below the threshold only', async () => {
        const innerFilterFor = async (semiJoinKeyThreshold: number) => {
            urls.length = 0;

            const store = new JoinStore(
                new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}` }),
                { semiJoinKeyThreshold }
            );

            await store.teams.join(s => s.members, t => t.id, m => m.teamId).toArrayAsync();

            const innerUrl = urls.find(url => url.includes('http_join_members'))!;

            return new URL(innerUrl).searchParams.get('filter');
        };

        // Three teams, so three distinct outer keys: a threshold of 3 admits them, 2 abandons it
        const withPrefilter = await innerFilterFor(3);
        const withoutPrefilter = await innerFilterFor(2);

        expect(withPrefilter).not.toBeNull();
        expect(withPrefilter).toContain('team-a');
        expect(withoutPrefilter).toBeNull();
    });

    it('pushes an outer filter into the outer request, as an ordinary query param', async () => {
        const pairs = await store().teams
            .where(t => t.name === 'Beta')
            .join(s => s.members, t => t.id, m => m.teamId)
            .map(([team, member]) => `${team.name}:${member.name}`)
            .toArrayAsync();

        const outerUrl = urls.find(url => url.includes('http_join_teams'));

        expect(outerUrl).toContain('filter=');
        // The mock serves every team regardless, so the filter is re-applied in memory — the
        // point here is that it reached the wire, not that the fake honoured it
        expect(pairs).toEqual(['Beta:Bo']);
    });

    it('keeps unmatched rows on a left join', async () => {
        const pairs = await store().teams
            .leftJoin(s => s.members, t => t.id, m => m.teamId)
            .sort(([team, member]) => `${team.name}:${member?.name ?? ''}`)
            .map(([team, member]) => `${team.name}:${member?.name ?? '-'}`)
            .toArrayAsync();

        expect(pairs).toEqual(['Alpha:Abe', 'Alpha:Ann', 'Beta:Bo', 'Gamma:-']);
    });

    // Refused rather than attempted: this plugin merges a local read with a remote one, and the
    // two would disagree about whether a row is an entity or a pair.
    it('is refused by the SWR plugin, with a message naming the alternative', async () => {
        const swr = new JoinStore(new HttpSwrDbPlugin(
            new MemoryPlugin(`swr-join-${uuidv4()}`),
            {
                getUrl: (collection: string) => `https://api.test/${collection}`,
                unsyncedQueueStore: new MemoryPlugin(`swr-queue-${uuidv4()}`),
            }
        ) as unknown as IDbPlugin);

        await expect(
            swr.teams.join(s => s.members, t => t.id, m => m.teamId).toArrayAsync()
        ).rejects.toThrow(/cannot execute a join/i);
    });
});
