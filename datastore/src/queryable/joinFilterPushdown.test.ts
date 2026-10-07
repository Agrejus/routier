import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackResult } from '@routier/core/results';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const teamSchema = s.define('pushdown_teams', {
    id: s.string().key(),
    region: s.string(),
}).compile();

const memberSchema = s.define('pushdown_members', {
    id: s.string().key(),
    teamId: s.string(),
    rank: s.number(),
}).compile();

class RecordingPlugin extends MemoryPlugin {
    readonly filters: string[] = [];

    override query<TEntity extends {}, TShape = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>) {
        const record = (collectionName: string, count: number) => this.filters.push(`${collectionName}:${count}`);

        record(event.operation.schema.collectionName, event.operation.options.get('filter').length);

        for (const join of event.operation.options.get('join')) {
            record(`${event.operation.schema.collectionName}>inner`, join.option.value.innerOptions.get('filter').length);
        }

        super.query(event, done);
    }
}

class Store extends DataStore {
    teams = this.collection(teamSchema).proxy().create();
    members = this.collection(memberSchema).proxy().create();
}

const stores: DataStore[] = [];

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('a where after a join', () => {

    it('pushes each single-side conjunct down to its own side', async () => {
        const plugin = new RecordingPlugin(`pushdown-${uuidv4()}`);
        const store = new Store(plugin);
        stores.push(store);

        await store.teams.addAsync({ id: 't1', region: 'east' }, { id: 't2', region: 'west' });
        await store.members.addAsync({ id: 'm1', teamId: 't1', rank: 20 }, { id: 'm2', teamId: 't1', rank: 5 }, { id: 'm3', teamId: 't2', rank: 30 });
        await store.saveChangesAsync();
        plugin.filters.splice(0);

        const pairs = await store.teams
            .join(x => x.members, team => team.id, member => member.teamId)
            .where(([team, member]) => team.region === 'east' && member.rank > 10)
            .toArrayAsync();

        expect(pairs.map(([team, member]) => `${team.id}:${member.id}`)).toEqual(['t1:m1']);
        expect(plugin.filters).toEqual(['pushdown_teams:1', 'pushdown_teams>inner:1']);
    });
});
