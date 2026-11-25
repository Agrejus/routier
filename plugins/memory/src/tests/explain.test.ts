import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';
import { executedQueriesOf } from '@routier/core/plugins';

const teamSchema = s.define("explain_teams", {
    _id: s.string().key().identity(),
    name: s.string(),
}).compile();

const memberSchema = s.define("explain_members", {
    _id: s.string().key().identity(),
    teamId: s.string(),
    name: s.string(),
}).compile();

class ExplainStore extends DataStore {
    teams = this.collection(teamSchema).proxy().create();
    members = this.collection(memberSchema).proxy().create();
}

describe('memory explain', () => {

    it('reports both reads of a join, outer first, with semi-join narrowing named', async () => {
        const store = new ExplainStore(new MemoryPlugin(`explain-${uuidv4()}`));

        const [alpha] = await store.teams.addAsync({ name: "Alpha" }, { name: "Beta" });
        await store.saveChangesAsync();
        await store.members.addAsync(
            { teamId: alpha._id, name: "Ann" },
            { teamId: "no-such-team", name: "Ora" }
        );
        await store.saveChangesAsync();

        const { data, explanation } = await store.teams
            .join(x => x.members, team => team._id, member => member.teamId)
            .explain()
            .toArrayAsync();

        expect(data).toHaveLength(1);

        const reported = executedQueriesOf(explanation);

        expect(reported).toHaveLength(2);
        expect(reported[0]).toEqual({ text: "explain_teams", language: "javascript", note: "returned 2 in-memory records" });
        expect(reported[1]).toEqual({
            text: "explain_members.filter(x => outerKeys.has(x.teamId))",
            language: "javascript",
            note: expect.stringMatching(/^the join's inner side: returned 1 in-memory record, narrowed by \d+ outer keys?$/),
        });

        await store.destroyAsync();
    });
});
