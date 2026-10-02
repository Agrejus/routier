import { describe, expect, it } from '@jest/globals';
import { IDbPlugin } from '@routier/core';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { InferRoot, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { describeEtagContract } from '@routier/test-utils';
import { MongoDbPlugin } from '../MongoDbPlugin';
import { FakeMongoDriver } from './FakeMongoDriver';

describeEtagContract('mongodb', () => new MongoDbPlugin(new FakeMongoDriver()));

const people = s.define('mongo_people', {
    _id: s.string().key().identity(),
    name: s.string(),
    city: s.string(),
}).compile();

class PeopleStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    people = this.collection(people).proxy().create();
}

describe('MongoDB partial updates', () => {
    it('writes only the fields that changed, so another writer\'s change survives', async () => {
        const plugin = new MongoDbPlugin(new FakeMongoDriver());
        const seeder = new PeopleStore(plugin);
        await seeder.people.addAsync({ name: 'Ann', city: 'Oslo' });
        await seeder.saveChangesAsync();
        const writerA = new PeopleStore(plugin);
        const writerB = new PeopleStore(plugin);
        const [a] = await writerA.people.toArrayAsync();
        const [b] = await writerB.people.toArrayAsync();

        if (a == null || b == null) {
            throw new Error('nothing stored');
        }

        a.name = 'Anna';
        await writerA.saveChangesAsync();
        b.city = 'Bergen';
        await writerB.saveChangesAsync();

        const [stored] = await new PeopleStore(plugin).people.toArrayAsync();
        expect([stored?.name, stored?.city]).toEqual(['Anna', 'Bergen']);
    });
});

const notes = s.define('mongo_notes', {
    _id: s.string().key(),
    body: s.string(),
    tag: s.string().optional(),
}).compile();

describe('MongoDB whole-entity updates', () => {
    it('replaces the document, so a field the entity no longer has is removed', async () => {
        const driver = new FakeMongoDriver();
        const plugin = new MongoDbPlugin(driver);
        const persist = (operation: BulkPersistChanges) => new Promise(resolve => plugin.bulkPersist({
            id: 'whole-entity',
            schemas: new SchemaCollection().set(notes.id, notes),
            operation,
            source: 'test',
            action: 'persist',
        }, resolve));
        const adds = new BulkPersistChanges();
        adds.resolve<InferRoot<typeof notes>>(notes.id).adds.push({ _id: 'a', body: 'first', tag: 'old' });
        await persist(adds);
        const updates = new BulkPersistChanges();
        updates.resolve<InferRoot<typeof notes>>(notes.id).updates.push({ entity: { _id: 'a', body: 'second' }, changeType: 'markedDirty', delta: {} });

        await persist(updates);

        expect(await (await driver.collection('mongo_notes')).find({})).toEqual([{ _id: 'a', body: 'second' }]);
    });
});
