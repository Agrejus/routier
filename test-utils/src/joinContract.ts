import { afterAll, describe, expect, it } from "@jest/globals";
import { IDbPlugin } from "@routier/core";
import { InferType, s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";

/**
 * The join suite every backend must pass, however it executes the join.
 *
 * This is the conformance half of the first guarantee in `specs/joins.md`: **the same data and
 * the same join return the same pairs on every plugin** — whether the pairing happened in a
 * native SQL `JOIN`, in a plugin's translator, or in the datastore's own memory half. Which one
 * did the work is observable only as speed, and this file is what makes that a fact rather than
 * an intention.
 *
 * Every scenario sorts. Pair order is UNDEFINED without a `.sort()`, and it genuinely differs
 * between a hash join and an index scan — asserting an unsorted order would be asserting an
 * implementation detail of whichever backend happened to be written first.
 *
 * A separate suite from `describePluginContract`, for the reason `vectorContract` gives: a
 * backend must not be unable to answer the one question asked here because of an unrelated
 * schema feature it does not support.
 *
 * ## Why the schemas look the way they do
 *
 * `_id: s.string().key().identity()` is the ONE key shape every supported backend accepts, and
 * two backends disagree in opposite directions about the alternatives: PouchDB keys documents by
 * `_id` and cannot use another property name, while MongoDB rejects an `_id` that is not
 * `.identity()` (Mongo fills a missing one in itself, so a non-identity `_id` comes back carrying
 * a value the change tracker never issued). `_rev` is there for the stores that need a revision to
 * write twice; it is an identity property, so a backend with no use for it never writes it.
 *
 * The consequence is that keys are assigned by the store, so the fixture links members to teams
 * AFTER the teams are saved, and every assertion reads NAMES rather than ids.
 */

export const joinContractTeamSchema = s.define("contract_join_teams", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string(),
    region: s.string()
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const joinContractMemberSchema = s.define("contract_join_members", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    teamId: s.string().nullable(),
    name: s.string(),
    rank: s.number(),
    deletedAt: s.date().nullable().default(() => null)
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const joinContractPartnerSchema = s.define("contract_join_partners", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    teamId: s.string(),
    tier: s.string()
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

/**
 * Every collection is scoped by a `documentType` discriminator.
 *
 * Not decoration: a document store keeps every collection in ONE database, so without it an
 * unfiltered read of `teams` returns the members too — and a join whose outer side has no
 * `.where()` is exactly that read. It also makes the suite test the harder thing: BOTH sides of
 * every join here carry a scope, so the inner side's copy has to travel in the join option and be
 * applied by whoever interprets it.
 */
class JoinContractDataStore extends DataStore {
    teams = this.collection(joinContractTeamSchema)
        .scope(([x, p]) => x.documentType === p.collectionName, { ...joinContractTeamSchema })
        .proxy().create();
    /** Removals stamp `deletedAt`, and every read is scoped to rows where it is empty. */
    members = this.collection(joinContractMemberSchema)
        .scope(([x, p]) => x.documentType === p.collectionName, { ...joinContractMemberSchema })
        .softDelete(x => x.deletedAt)
        .proxy().create();
    /** A second scope on the inner side, so a caller-declared one is asserted as well. */
    partners = this.collection(joinContractPartnerSchema)
        .scope(([x, p]) => x.documentType === p.collectionName, { ...joinContractPartnerSchema })
        .scope(x => x.tier === "gold")
        .proxy().create();
}

type Team = InferType<typeof joinContractTeamSchema>;
type Member = InferType<typeof joinContractMemberSchema>;

const labels = (pairs: [Team, Member | undefined][]) =>
    pairs.map(([team, member]) => `${team.name}:${member?.name ?? "-"}`);

export const describeJoinContract = (name: string, pluginFactory: () => IDbPlugin) => {

    const stores: JoinContractDataStore[] = [];

    /**
     * Three teams, five members — every rule at once.
     *
     * Alpha has two members (a duplicate key group), Gamma has none (an unmatched outer row), Ora
     * points at a team id that does not exist (an unmatched inner row), and Nil has no team at all
     * (a null key).
     */
    const seeded = async () => {
        const store = new JoinContractDataStore(pluginFactory());
        stores.push(store);

        const [alpha, beta] = await store.teams.addAsync(
            { name: "Alpha", region: "east" },
            { name: "Beta", region: "west" },
            { name: "Gamma", region: "east" }
        );

        // Saved first: the keys are assigned by the store, and the members below reference them.
        await store.saveChangesAsync();

        await store.members.addAsync(
            { teamId: alpha._id, name: "Ann", rank: 10 },
            { teamId: alpha._id, name: "Abe", rank: 20 },
            { teamId: beta._id, name: "Bo", rank: 30 },
            { teamId: "team-that-does-not-exist", name: "Ora", rank: 40 },
            { teamId: null, name: "Nil", rank: 50 }
        );

        await store.saveChangesAsync();

        return { store, alpha, beta };
    };

    describe(`${name} join contract`, () => {

        afterAll(async () => {
            await Promise.all(stores.map(store => store.destroyAsync()));
        });

        it("pairs matching rows and drops unmatched ones from both sides", async () => {
            const { store } = await seeded();

            const pairs = await store.teams
                .join(s => s.members, team => team._id, member => member.teamId)
                .sort(([team, member]) => `${team.name}:${member.name}`)
                .toArrayAsync();

            // A duplicate key group emits every pair; Gamma, Ora and Nil match nothing
            expect(labels(pairs)).toEqual(["Alpha:Abe", "Alpha:Ann", "Beta:Bo"]);
        });

        it("keeps unmatched outer rows on a left join, paired with undefined", async () => {
            const { store } = await seeded();

            const pairs = await store.teams
                .leftJoin(s => s.members, team => team._id, member => member.teamId)
                .sort(([team, member]) => `${team.name}:${member?.name ?? ""}`)
                .toArrayAsync();

            expect(labels(pairs)).toEqual(["Alpha:Abe", "Alpha:Ann", "Beta:Bo", "Gamma:-"]);
            // `undefined`, not an entity whose properties are all null — the two mean different
            // things to a caller checking `member == null`
            expect(pairs[3][1]).toBeUndefined();
        });

        it("never matches a null key, and keeps it on a left join", async () => {
            const { store } = await seeded();

            const pairs = await store.members
                .leftJoin(s => s.teams, member => member.teamId, team => team._id)
                .toArrayAsync();

            const nullKeyed = pairs.filter(([member]) => member.name === "Nil");

            expect(nullKeyed).toHaveLength(1);
            expect(nullKeyed[0][1]).toBeUndefined();
        });

        it("yields no pairs when the inner side is empty", async () => {
            const { store } = await seeded();

            const pairs = await store.teams
                .join(s => s.partners, team => team._id, partner => partner.teamId)
                .toArrayAsync();

            expect(pairs).toEqual([]);
        });

        // The correctness trap. Every interpretation of a join bypasses the inner collection's
        // read path, so its soft-delete scope exists only because the join option carries it — an
        // interpreter that ignores it returns deleted rows and nothing errors.
        it("excludes soft-deleted inner rows", async () => {
            const { store } = await seeded();

            await store.members.removeAsync(await store.members.firstAsync(member => member.name === "Ann"));
            await store.saveChangesAsync();

            const pairs = await store.teams
                .join(s => s.members, team => team._id, member => member.teamId)
                .sort(([team, member]) => `${team.name}:${member.name}`)
                .toArrayAsync();

            expect(labels(pairs)).toEqual(["Alpha:Abe", "Beta:Bo"]);
        });

        it("applies a .scope() filter declared on the inner collection", async () => {
            const { store, alpha } = await seeded();

            await store.partners.addAsync(
                { teamId: alpha._id, tier: "gold" },
                { teamId: alpha._id, tier: "silver" }
            );
            await store.saveChangesAsync();

            const pairs = await store.teams
                .join(s => s.partners, team => team._id, partner => partner.teamId)
                .toArrayAsync();

            expect(pairs.map(([, partner]) => partner.tier)).toEqual(["gold"]);
        });

        it("runs post-join options over the pairs", async () => {
            const { store } = await seeded();

            const rows = await store.teams
                .join(s => s.members, team => team._id, member => member.teamId)
                .where(([team, member]) => team.region === "east" && member.rank > 10)
                .sort(([, member]) => member.rank)
                .map(([team, member]) => `${team.name}/${member.name}`)
                .toArrayAsync();

            expect(rows).toEqual(["Alpha/Abe"]);
        });

        // Counting PAIRS, not outer rows. This is what everything-after-a-join-runs-in-memory
        // buys: a `count` pushed to a backend that paired in its translator would count whatever
        // that backend happened to select.
        it("counts pairs", async () => {
            const { store } = await seeded();

            expect(await store.teams.join(s => s.members, t => t._id, m => m.teamId).countAsync()).toBe(3);
            expect(await store.teams.leftJoin(s => s.members, t => t._id, m => m.teamId).countAsync()).toBe(4);
        });

        it("explains a joined query: same rows, plus at least one reported read", async () => {
            const { store } = await seeded();

            const { data, explanation } = await store.teams
                .join(s => s.members, team => team._id, member => member.teamId)
                .sort(([team, member]) => `${team.name}:${member.name}`)
                .explain()
                .toArrayAsync();

            expect(labels(data)).toEqual(["Alpha:Abe", "Alpha:Ann", "Beta:Bo"]);

            const optionNames = explanation.executionSteps.flatMap(step => step.options.map(option => option.name));
            expect(optionNames).toContain("join");

            const reported = explanation.executionSteps.flatMap(step => step.executedQueries ?? []);
            expect(reported.length).toBeGreaterThan(0);

            for (const executed of reported) {
                expect(typeof executed.text).toBe("string");
                expect(executed.text.trim().length).toBeGreaterThan(0);
            }
        });

        it("returns read-only projections, with no change tracking on either half", async () => {
            const { store } = await seeded();

            const pairs = await store.teams
                .join(s => s.members, team => team._id, member => member.teamId)
                .toArrayAsync();

            pairs[0][0].name = "changed";
            pairs[0][1]!.name = "changed too";

            expect(await store.hasChangesAsync()).toBe(false);
        });
    });
};
