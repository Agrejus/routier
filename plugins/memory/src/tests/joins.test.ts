import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { InferType, s } from '@routier/core/schema';
import { DataStore, DataStoreOptions } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';
import { waitFor } from './utils/waitFor';

const teamSchema = s.define("teams", {
    id: s.string().key(),
    name: s.string(),
    region: s.string()
}).compile();

const memberSchema = s.define("members", {
    id: s.string().key(),
    teamId: s.string().nullable(),
    name: s.string(),
    rank: s.number(),
    deletedAt: s.date().nullable().default(() => null)
}).compile();

/** A second member-shaped collection, scoped, so a scope on the INNER side can be asserted. */
const partnerSchema = s.define("partners", {
    id: s.string().key(),
    teamId: s.string(),
    tier: s.string()
}).compile();

/** `teamId` is stored as `t`, so a join can be keyed on a renamed property. */
const sponsorSchema = s.define("sponsors", {
    id: s.string().key(),
    teamId: s.string().from("t"),
    label: s.string()
}).compile();

/** An array property, so aliasing between a joined half and the plugin's storage is testable. */
const rosterSchema = s.define("rosters", {
    id: s.string().key(),
    teamId: s.string(),
    tags: s.array(s.string())
}).compile();

const teamSummarySchema = s.define("teamSummaries", {
    id: s.string().key(),
    teamId: s.string(),
    memberCount: s.number()
}).compile();

class JoinDataStore extends DataStore {
    constructor(plugin: IDbPlugin, options?: DataStoreOptions) {
        super(plugin, options);
    }

    teams = this.collection(teamSchema).proxy().create();
    /** Soft-deleted members must never appear as the inner side of a join. */
    members = this.collection(memberSchema).softDelete(x => x.deletedAt).proxy().create();
    partners = this.collection(partnerSchema).scope(x => x.tier === "gold").proxy().create();
    sponsors = this.collection(sponsorSchema).proxy().create();
    rosters = this.collection(rosterSchema).proxy().create();

    /** A VIEW as a join side — required, because full-text search depends on it. */
    teamSummaries = this.view(teamSummarySchema).derive(done => {
        return this.members.subscribe().toArray(response => {
            if (response.ok === "error") {
                return done([]);
            }

            const counts = new Map<string, number>();

            for (const member of response.data) {
                if (member.teamId == null) {
                    continue;
                }

                counts.set(member.teamId, (counts.get(member.teamId) ?? 0) + 1);
            }

            done([...counts].map(([teamId, memberCount]) => ({
                id: `summary:${teamId}`,
                teamId,
                memberCount
            })));
        });
    }).create();
}

const stores: DataStore[] = [];

const factory = (databaseName?: string, semiJoinKeyThreshold?: number) => {
    const store = new JoinDataStore(new MemoryPlugin(databaseName ?? uuidv4()), { semiJoinKeyThreshold });
    stores.push(store);
    return store;
};

/**
 * Two teams, four members. Enough to exercise every rule at once: a duplicate key group (a1/a2
 * both on team-a), an unmatched outer row (team-c has nobody), an unmatched inner row (m-orphan
 * points at no team), a null key, and a soft-deleted member.
 */
const seed = async (store: JoinDataStore) => {
    await store.teams.addAsync(
        { id: "team-a", name: "Alpha", region: "east" },
        { id: "team-b", name: "Beta", region: "west" },
        { id: "team-c", name: "Gamma", region: "east" }
    );

    await store.members.addAsync(
        { id: "m-a1", teamId: "team-a", name: "Ann", rank: 10 },
        { id: "m-a2", teamId: "team-a", name: "Abe", rank: 20 },
        { id: "m-b1", teamId: "team-b", name: "Bo", rank: 30 },
        { id: "m-orphan", teamId: "team-missing", name: "Ora", rank: 40 },
        { id: "m-null", teamId: null, name: "Nil", rank: 50 }
    );

    await store.saveChangesAsync();
};

const names = (pairs: [InferType<typeof teamSchema>, InferType<typeof memberSchema> | undefined][]) =>
    pairs.map(([team, member]) => `${team.id}:${member?.id ?? "-"}`);

describe("Joins", () => {

    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync()));
    });

    // The everyday form: a store can see its own collections, so a sibling is named once.
    describe("naming the inner side with a store selector", () => {

        it("resolves the collection off the store", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(s => s.members, t => t.id, m => m.teamId)
                .sort(([team, member]) => `${team.id}:${member.id}`)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-a:m-a1", "team-a:m-a2", "team-b:m-b1"]);
        });

        it("works after an outer where, so the store type survives the chain", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .where(t => t.region === "west")
                .join(s => s.members, t => t.id, m => m.teamId)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-b:m-b1"]);
        });

        it("carries the inner side's scopes exactly as the direct form does", async () => {
            const store = factory();
            await seed(store);

            await store.members.removeAsync(await store.members.firstAsync(m => m.id === "m-a1"));
            await store.saveChangesAsync();

            const pairs = await store.teams
                .join(s => s.members, t => t.id, m => m.teamId)
                .sort(([team, member]) => `${team.id}:${member.id}`)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-a:m-a2", "team-b:m-b1"]);
        });

        it("resolves a view off the store too", async () => {
            const store = factory();
            await seed(store);

            await waitFor(async () => (await store.teamSummaries.countAsync()) === 3);

            const pairs = await store.teams
                .leftJoin(s => s.teamSummaries, t => t.id, summary => summary.teamId)
                .sort(([team]) => team.id)
                .toArrayAsync();

            expect(pairs.map(([team, summary]) => `${team.id}:${summary?.memberCount ?? "-"}`))
                .toEqual(["team-a:2", "team-b:1", "team-c:-"]);
        });

        it("rejects a collection the store does not declare, at compile time", () => {
            const store = factory();

            // @ts-expect-error the store has no `rosterz` collection
            const wrong = () => store.teams.join(s => s.rosterz, t => t.id, r => r.teamId);

            expect(typeof wrong).toBe("function");
        });
    });

    describe("inner join", () => {

        it("returns one pair per match, and drops unmatched rows from both sides", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(store.members, t => t.id, m => m.teamId)
                .sort(([team, member]) => `${team.id}:${member.id}`)
                .toArrayAsync();

            // team-c has no members and m-orphan/m-null match no team
            expect(names(pairs)).toEqual(["team-a:m-a1", "team-a:m-a2", "team-b:m-b1"]);
        });

        it("hands back both halves fully deserialized into their own entity shape", async () => {
            const store = factory();
            await seed(store);

            const [[team, member]] = await store.teams
                .where(t => t.id === "team-b")
                .join(store.members, t => t.id, m => m.teamId)
                .toArrayAsync();

            expect(team.name).toBe("Beta");
            expect(member.name).toBe("Bo");
            expect(member.rank).toBe(30);
        });
    });

    describe("left join", () => {

        it("keeps outer rows with no match, paired with undefined", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .leftJoin(store.members, t => t.id, m => m.teamId)
                .sort(([team, member]) => `${team.id}:${member?.id ?? ""}`)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-a:m-a1", "team-a:m-a2", "team-b:m-b1", "team-c:-"]);
        });

        it("gives undefined rather than an entity of nulls", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .where(t => t.id === "team-c")
                .leftJoin(store.members, t => t.id, m => m.teamId)
                .toArrayAsync();

            expect(pairs).toHaveLength(1);
            expect(pairs[0][1]).toBeUndefined();
        });

        it("keeps an outer row whose key is null", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.members
                .leftJoin(store.teams, m => m.teamId, t => t.id)
                .toArrayAsync();

            const nullKeyed = pairs.filter(([member]) => member.id === "m-null");

            expect(nullKeyed).toHaveLength(1);
            expect(nullKeyed[0][1]).toBeUndefined();
        });
    });

    // Every interpretation of a join bypasses the inner collection's normal read path, so the
    // inner side's scopes exist only because the option carries them. This is the test that
    // proves an interpreter did not skip them.
    describe("the inner side's own scopes", () => {

        it("excludes soft-deleted inner rows", async () => {
            const store = factory();
            await seed(store);

            await store.members.removeAsync(await store.members.firstAsync(m => m.id === "m-a1"));
            await store.saveChangesAsync();

            const pairs = await store.teams
                .join(store.members, t => t.id, m => m.teamId)
                .sort(([team, member]) => `${team.id}:${member.id}`)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-a:m-a2", "team-b:m-b1"]);
        });

        it("applies a .scope() filter on the inner collection", async () => {
            const store = factory();
            await seed(store);

            await store.partners.addAsync(
                { id: "p-gold", teamId: "team-a", tier: "gold" },
                { id: "p-silver", teamId: "team-a", tier: "silver" }
            );
            await store.saveChangesAsync();

            const pairs = await store.teams
                .join(store.partners, t => t.id, p => p.teamId)
                .toArrayAsync();

            expect(pairs.map(([, partner]) => partner.id)).toEqual(["p-gold"]);
        });
    });

    describe("post-join options", () => {

        it("filters the tuples, including across both sides", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(store.members, t => t.id, m => m.teamId)
                .where(([team, member]) => team.region === "east" && member.rank > 10)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-a:m-a2"]);
        });

        it("sorts by either half", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(store.members, t => t.id, m => m.teamId)
                .sortDescending(([, member]) => member.rank)
                .toArrayAsync();

            expect(pairs.map(([, member]) => member.rank)).toEqual([30, 20, 10]);
        });

        it("projects tuples with map", async () => {
            const store = factory();
            await seed(store);

            const rows = await store.teams
                .join(store.members, t => t.id, m => m.teamId)
                .sort(([, member]) => member.rank)
                .map(([team, member]) => ({ team: team.name, member: member.name }))
                .toArrayAsync();

            expect(rows).toEqual([
                { team: "Alpha", member: "Ann" },
                { team: "Alpha", member: "Abe" },
                { team: "Beta", member: "Bo" }
            ]);
        });

        // Counting PAIRS, not outer rows — the reason everything after a join runs in the
        // memory half. A `count` sent to a backend that joined in its translator would count
        // whatever that backend selected.
        it("counts pairs", async () => {
            const store = factory();
            await seed(store);

            expect(await store.teams.join(store.members, t => t.id, m => m.teamId).countAsync()).toBe(3);
            expect(await store.teams.leftJoin(store.members, t => t.id, m => m.teamId).countAsync()).toBe(4);
        });

        it("skips and takes pairs", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(store.members, t => t.id, m => m.teamId)
                .sort(([, member]) => member.rank)
                .skip(1)
                .take(1)
                .toArrayAsync();

            expect(pairs.map(([, member]) => member.rank)).toEqual([20]);
        });

        it("returns the first pair, and undefined when there is none", async () => {
            const store = factory();
            await seed(store);

            const [team, member] = await store.teams
                .join(store.members, t => t.id, m => m.teamId)
                .sort(([, m]) => m.rank)
                .firstAsync();

            expect(team.id).toBe("team-a");
            expect(member.id).toBe("m-a1");

            const none = await store.teams
                .where(t => t.id === "team-c")
                .join(store.members, t => t.id, m => m.teamId)
                .firstOrUndefinedAsync();

            expect(none).toBeUndefined();
        });
    });

    it("pushes an outer filter recorded BEFORE the join down to the outer side", async () => {
        const store = factory();
        await seed(store);

        const pairs = await store.teams
            .where(t => t.region === "west")
            .join(store.members, t => t.id, m => m.teamId)
            .toArrayAsync();

        expect(names(pairs)).toEqual(["team-b:m-b1"]);
    });

    it("keys on a renamed property", async () => {
        const store = factory();
        await seed(store);

        await store.sponsors.addAsync({ id: "s-1", teamId: "team-a", label: "Acme" });
        await store.saveChangesAsync();

        const pairs = await store.teams
            .join(store.sponsors, t => t.id, sponsor => sponsor.teamId)
            .toArrayAsync();

        expect(pairs.map(([team, sponsor]) => `${team.id}:${sponsor.label}`)).toEqual(["team-a:Acme"]);
    });

    it("joins to a view", async () => {
        const store = factory();
        await seed(store);

        // A view recomputes off its source's subscription, so the rows exist a tick after the
        // save rather than during it. Nothing about the join is asynchronous here — this waits
        // for the view to have anything to join TO.
        await waitFor(async () => (await store.teamSummaries.countAsync()) === 3);

        const pairs = await store.teams
            .join(store.teamSummaries, t => t.id, summary => summary.teamId)
            .sort(([team]) => team.id)
            .toArrayAsync();

        expect(pairs.map(([team, summary]) => `${team.id}:${summary.memberCount}`)).toEqual(["team-a:2", "team-b:1"]);
    });

    // Join results are read-only projections, exactly like .map() results: a tuple half is not
    // an attached entity, so writing to it is not a pending change.
    it("does not change-track either half of a pair", async () => {
        const store = factory();
        await seed(store);

        const pairs = await store.teams
            .join(store.members, t => t.id, m => m.teamId)
            .toArrayAsync();

        pairs[0][0].name = "changed";
        pairs[0][1]!.name = "changed too";

        expect(await store.hasChangesAsync()).toBe(false);
    });

    // Deserialization builds a new object for the entity, but an array property can come through
    // by reference — and for this plugin that reference is its own storage. Without a clone,
    // appending to a joined row's array edits the database, and nothing says so.
    it("does not hand back arrays that alias the stored records", async () => {
        const store = factory();
        await seed(store);

        await store.rosters.addAsync({ id: "r-a", teamId: "team-a", tags: ["first"] });
        await store.saveChangesAsync();

        const [[, roster]] = await store.teams
            .join(store.rosters, t => t.id, r => r.teamId)
            .toArrayAsync();

        roster.tags.push("appended");

        const stored = await store.rosters.firstAsync(r => r.id === "r-a");

        expect(stored.tags).toEqual(["first"]);
    });

    /**
     * The semi-join prefilter narrows what the inner side READS, never what the join RETURNS.
     *
     * So the only assertion worth making is that it changes nothing. Each case runs the same join
     * over the same data twice — once with the prefilter engaged, once with it disabled by a
     * threshold of 0 — and demands the same pairs.
     */
    describe("semi-join prefilter", () => {

        const read = (store: JoinDataStore) => store.teams
            .join(s => s.members, t => t.id, m => m.teamId)
            .sort(([team, member]) => `${team.id}:${member.id}`)
            .toArrayAsync();

        const seededPair = async (threshold: number) => {
            const databaseName = uuidv4();
            const store = factory(databaseName, threshold);
            await seed(store);
            return store;
        };

        it("returns the same pairs with the prefilter on as with it off", async () => {
            const withPrefilter = await seededPair(500);
            const without = await seededPair(0);

            expect(names(await read(withPrefilter))).toEqual(names(await read(without)));
            expect(names(await read(withPrefilter))).toEqual(["team-a:m-a1", "team-a:m-a2", "team-b:m-b1"]);
        });

        // The fixture has three teams, so three distinct outer keys. A threshold of 3 engages the
        // prefilter and 2 abandons it — the two sides of the boundary must agree.
        it("agrees at the threshold and one above it", async () => {
            const at = await seededPair(3);
            const above = await seededPair(2);

            expect(names(await read(at))).toEqual(names(await read(above)));
        });

        it("still applies the inner side's scopes when the prefilter narrowed the read", async () => {
            const store = await seededPair(500);

            await store.members.removeAsync(await store.members.firstAsync(m => m.id === "m-a1"));
            await store.saveChangesAsync();

            expect(names(await read(store))).toEqual(["team-a:m-a2", "team-b:m-b1"]);
        });

        /**
         * Proof the prefilter actually engages.
         *
         * Every other test here passes just as well with the feature dead, because they assert
         * results and the prefilter is defined not to change them. This one watches the inner
         * READ: a cross-plugin join sends the inner side to a separate plugin, so a recording
         * wrapper sees exactly which filters it was asked for.
         *
         * Only events carrying `reason: "join inner side"` are counted. The store also holds a
         * view subscribed to `members`, which re-queries whenever they change — counting every
         * read of that collection picks up the view's and the assertion turns to noise.
         *
         * The threshold is configured on the OUTER store, because that is where `.join()` records
         * the option and therefore where the setting is read from.
         */
        it("narrows the inner read below the threshold, and does not above it", async () => {
            const innerFilterCounts: number[] = [];

            class RecordingPlugin implements IDbPlugin {
                constructor(private readonly inner: IDbPlugin) { }
                get databaseName() { return this.inner.databaseName; }
                query(event: any, done: any) {
                    if (event.reason === "join inner side") {
                        innerFilterCounts.push(event.operation.options.get("filter").length);
                    }
                    return this.inner.query(event, done);
                }
                bulkPersist(event: any, done: any) { return this.inner.bulkPersist(event, done); }
                destroy(event: any, done: any) { return this.inner.destroy(event, done); }
            }

            const right = new JoinDataStore(new RecordingPlugin(new MemoryPlugin(uuidv4())));
            stores.push(right);
            await seed(right);

            const countFiltersFor = async (threshold: number) => {
                const left = factory(undefined, threshold);
                await seed(left);

                innerFilterCounts.length = 0;
                await left.teams.join(right.members, t => t.id, m => m.teamId).toArrayAsync();

                return innerFilterCounts.at(-1);
            };

            // Three distinct outer keys: a threshold of 3 admits them, 2 abandons the prefilter.
            const withPrefilter = await countFiltersFor(3);
            const withoutPrefilter = await countFiltersFor(2);

            // One extra filter — the key list — on top of the inner side's own soft-delete scope
            expect(withoutPrefilter).toBe(1);
            expect(withPrefilter).toBe(2);
        });

        it("returns no pairs when the outer side has no usable keys at all", async () => {
            const store = await seededPair(500);

            // An empty key set is a real answer — nothing can pair — and must not be mistaken for
            // "do not prefilter", which would return every pair.
            const pairs = await store.teams
                .where(t => t.id === "nothing-matches-this")
                .join(s => s.members, t => t.id, m => m.teamId)
                .toArrayAsync();

            expect(pairs).toEqual([]);
        });
    });

    /**
     * Conjunct splitting: the single-side halves of a post-join `where` narrow their own read.
     *
     * The caller's filter is left in place and re-checks every pair, so the only thing that can go
     * wrong is narrowing too little. Both facts are asserted — the pairs, and that the reads really
     * were narrowed.
     */
    describe("post-join conjunct splitting", () => {

        it("returns the pairs the unsplit filter would have", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(s => s.members, t => t.id, m => m.teamId)
                .where(([team, member]) => team.region === "east" && member.rank > 10)
                .sort(([team, member]) => `${team.id}:${member.id}`)
                .toArrayAsync();

            // Only Abe: east team, rank above 10
            expect(names(pairs)).toEqual(["team-a:m-a2"]);
        });

        it("leaves a condition spanning both sides alone", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(s => s.members, t => t.id, m => m.teamId)
                .where(([team, member]) => team.name.length < member.name.length)
                .toArrayAsync();

            // "Alpha"/"Beta" against "Ann"/"Abe"/"Bo" — no pair qualifies, and the point is that it
            // is answered correctly rather than pushed to a side it does not belong to
            expect(names(pairs)).toEqual([]);
        });

        /**
         * Proof the split reaches the reads.
         *
         * A cross-plugin join sends each side to a separate plugin, so a recording wrapper sees the
         * filters each was asked for. Without splitting, the inner read carries only the inner
         * collection's own scope; with it, the inner conjunct is there too.
         */
        it("narrows both sides' reads, not just the result", async () => {
            const seen: { reason: string, filters: number }[] = [];

            class RecordingPlugin implements IDbPlugin {
                constructor(private readonly inner: IDbPlugin) { }
                get databaseName() { return this.inner.databaseName; }
                query(event: any, done: any) {
                    if (event.reason != null) {
                        seen.push({ reason: event.reason, filters: event.operation.options.get("filter").length });
                    }
                    return this.inner.query(event, done);
                }
                bulkPersist(event: any, done: any) { return this.inner.bulkPersist(event, done); }
                destroy(event: any, done: any) { return this.inner.destroy(event, done); }
            }

            const right = new JoinDataStore(new RecordingPlugin(new MemoryPlugin(uuidv4())));
            stores.push(right);
            await seed(right);

            const left = factory();
            await seed(left);

            seen.length = 0;

            const pairs = await left.teams
                .join(right.members, t => t.id, m => m.teamId)
                .where(([team, member]) => team.region === "east" && member.rank > 10)
                .sort(([team, member]) => `${team.id}:${member.id}`)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-a:m-a2"]);

            const innerRead = seen.find(x => x.reason === "join inner side");

            // The inner collection's soft-delete scope, the semi-join key list, and `rank > 10`
            expect(innerRead?.filters).toBe(3);
        });

        it("pushes an inner conjunct even when nothing pushes on the outer side", async () => {
            const store = factory();
            await seed(store);

            const pairs = await store.teams
                .join(s => s.members, t => t.id, m => m.teamId)
                .where(([, member]) => member.rank >= 30)
                .toArrayAsync();

            expect(names(pairs)).toEqual(["team-b:m-b1"]);
        });
    });

    // Neither plugin can read the other's rows, so no plugin can receive the option — the
    // datastore runs both sides and joins in its own memory half, with the same shared code.
    it("joins across two stores on two plugins", async () => {
        const left = factory();
        const right = factory();

        await seed(left);
        await seed(right);

        const pairs = await left.teams
            .join(right.members, t => t.id, m => m.teamId)
            .sort(([team, member]) => `${team.id}:${member.id}`)
            .toArrayAsync();

        expect(names(pairs)).toEqual(["team-a:m-a1", "team-a:m-a2", "team-b:m-b1"]);
    });

    it("applies the inner side's scopes on a cross-plugin join too", async () => {
        const left = factory();
        const right = factory();

        await seed(left);
        await seed(right);

        await right.members.removeAsync(await right.members.firstAsync(m => m.id === "m-b1"));
        await right.saveChangesAsync();

        const pairs = await left.teams
            .join(right.members, t => t.id, m => m.teamId)
            .sort(([team, member]) => `${team.id}:${member.id}`)
            .toArrayAsync();

        expect(names(pairs)).toEqual(["team-a:m-a1", "team-a:m-a2"]);
    });

    // Every one of these throws where the selector is written. A join with an unusable key has
    // no partially-correct behaviour to fall back to, so failing at execution would only move
    // the error further from its cause.
    describe("build-time validation", () => {

        it("rejects a key selector that is not a single property path", () => {
            const store = factory();

            expect(() => store.teams.join(store.members, t => t.id, m => (m.teamId ?? "") as string))
                .toThrow(/single property path/);
        });

        it("rejects a key the schema does not declare", () => {
            const store = factory();

            expect(() => store.teams.join(store.members, t => (t as never as { nope: string }).nope, m => m.teamId))
                .toThrow(/does not declare/);
        });

        // The one rule the compiler enforces rather than a throw. `@ts-expect-error` IS the
        // assertion here: if the call below ever type-checks, this line fails the build.
        it("rejects a mismatched pair of key types before it runs", () => {
            const store = factory();

            // @ts-expect-error a string key cannot be joined to a number key
            const mismatched = () => store.teams.join(store.members, t => t.id, m => m.rank);

            expect(typeof mismatched).toBe("function");
        });

        it("rejects a key that is not a string or number", () => {
            const store = factory();

            expect(() => store.members.join(store.teams, m => m.deletedAt as never as string, t => t.id))
                .toThrow(/string or number/);
        });
    });
});
