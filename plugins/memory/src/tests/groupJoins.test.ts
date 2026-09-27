import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { InferType, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';

const teamSchema = s.define("teams", {
    id: s.string().key(),
    name: s.string(),
    region: s.string()
}).compile();

const memberSchema = s.define("members", {
    id: s.string().key(),
    teamId: s.string().nullable(),
    name: s.string(),
    rank: s.number()
}).compile();

const trackSchema = s.define("tracks", {
    id: s.string().key(),
    teamId: s.string(),
    length: s.number()
}).compile();

type Team = InferType<typeof teamSchema>;
type Member = InferType<typeof memberSchema>;

class GroupJoinDataStore extends DataStore {
    teams = this.collection(teamSchema).proxy().create();
    members = this.collection(memberSchema).proxy().create();
    tracks = this.collection(trackSchema).proxy().create();
}

type ReadRecord = { reason: string, filters: number };

class RecordingPlugin implements IDbPlugin {
    readonly reads: ReadRecord[] = [];

    constructor(private readonly inner: IDbPlugin) { }

    get databaseName() {
        return this.inner.databaseName;
    }

    query: IDbPlugin["query"] = (event, done) => {
        if (event.reason != null) {
            this.reads.push({ reason: event.reason, filters: event.operation.options.get("filter").length });
        }

        return this.inner.query(event, done);
    };

    bulkPersist: IDbPlugin["bulkPersist"] = (event, done) => this.inner.bulkPersist(event, done);

    destroy: IDbPlugin["destroy"] = (event, done) => this.inner.destroy(event, done);
}

const stores: DataStore[] = [];

const seeded = async (plugin: IDbPlugin = new MemoryPlugin(uuidv4())) => {
    const store = new GroupJoinDataStore(plugin);
    stores.push(store);

    await store.teams.addAsync(
        { id: "team-a", name: "Alpha", region: "east" },
        { id: "team-b", name: "Beta", region: "west" },
        { id: "team-c", name: "Gamma", region: "east" }
    );
    await store.members.addAsync(
        { id: "m-a1", teamId: "team-a", name: "Ann", rank: 10 },
        { id: "m-a2", teamId: "team-a", name: "Abe", rank: 20 },
        { id: "m-b1", teamId: "team-b", name: "Bo", rank: 30 },
        { id: "m-null", teamId: null, name: "Nil", rank: 50 }
    );
    await store.saveChangesAsync();

    return store;
};

const labels = (groups: [Team, Member[]][]) =>
    groups.map(([team, members]) => `${team.id}:${members.map(member => member.id).sort().join(",")}`);

describe("Group joins", () => {

    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync()));
    });

    it("groups across two stores on two plugins", async () => {
        const left = await seeded();
        const right = await seeded();

        const groups = await left.teams
            .groupJoin(right.members, team => team.id, member => member.teamId)
            .sort(([team]) => team.id)
            .toArrayAsync();

        expect(labels(groups)).toEqual(["team-a:m-a1,m-a2", "team-b:m-b1", "team-c:"]);
    });

    it("groups after an outer where, keeping only the filtered outer rows", async () => {
        const store = await seeded();

        const groups = await store.teams
            .where(team => team.region === "east")
            .groupJoin(s => s.members, team => team.id, member => member.teamId)
            .sort(([team]) => team.id)
            .toArrayAsync();

        expect(labels(groups)).toEqual(["team-a:m-a1,m-a2", "team-c:"]);
    });

    it("groups from a subscribed query builder", async () => {
        const store = await seeded();

        const groups = await new Promise<[Team, Member[]][]>((resolve, reject) => {
            store.teams
                .where(team => team.region === "west")
                .subscribe()
                .groupJoin(store.members, team => team.id, member => member.teamId)
                .toArray(result => result.ok === "error" ? reject(result.error) : resolve(result.data));
        });

        expect(labels(groups)).toEqual(["team-b:m-b1"]);
    });

    it("never narrows the inner read with a condition on the grouped array", async () => {
        const recording = new RecordingPlugin(new MemoryPlugin(uuidv4()));
        const right = await seeded(recording);
        const left = await seeded();

        recording.reads.length = 0;

        const groups = await left.teams
            .groupJoin(right.members, team => team.id, member => member.teamId)
            .where(([team, members]) => team.region === "east" && members.length > 1)
            .toArrayAsync();

        const innerRead = recording.reads.find(read => read.reason === "join inner side");

        expect(labels(groups)).toEqual(["team-a:m-a1,m-a2"]);
        expect(innerRead?.filters).toBe(1);
    });

    it("reads the grouped array's length even when the inner schema has a length property", async () => {
        const store = await seeded();

        await store.tracks.addAsync(
            { id: "t-a1", teamId: "team-a", length: 1 },
            { id: "t-a2", teamId: "team-a", length: 1 },
            { id: "t-b1", teamId: "team-b", length: 9 }
        );
        await store.saveChangesAsync();

        const teams = await store.teams
            .groupJoin(s => s.tracks, team => team.id, track => track.teamId)
            .where(([team, tracks]) => team.region !== "" && tracks.length > 1)
            .map(([team, tracks]) => `${team.id}:${tracks.length}`)
            .toArrayAsync();

        expect(teams).toEqual(["team-a:2"]);
    });

    it("still narrows the outer read with a condition on the outer row", async () => {
        const recording = new RecordingPlugin(new MemoryPlugin(uuidv4()));
        const left = await seeded(recording);
        const right = await seeded();

        recording.reads.length = 0;

        const groups = await left.teams
            .groupJoin(right.members, team => team.id, member => member.teamId)
            .where(([team, members]) => team.region === "west" && members.length > 0)
            .toArrayAsync();

        expect(labels(groups)).toEqual(["team-b:m-b1"]);
        expect(recording.reads).toEqual([]);
    });
});
