import { OptimisticUpdatesDbPlugin } from '@routier/replication-plugin';
import { MemoryPlugin } from '@routier/memory-plugin';
import { Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';

const testSchema = s.define('items', {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

const buildSchemas = () => {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema);
    return schemas;
};

const queryRows = (plugin) => new Promise((resolve, reject) => {
    plugin.query({
        id: uuid(8), schemas: buildSchemas(), source: 'repro', action: 'query',
        explain: false, executedQueries: [], operation: Query.EMPTY(testSchema),
    }, (result) => {
        if (result.ok === Result.ERROR) return reject(result.error);
        const rows = [];
        result.data.forEach((r) => rows.push(r));
        resolve(rows);
    });
});

const persist = (plugin, changes) => new Promise((resolve, reject) => {
    const operation = new BulkPersistChanges();
    const schemaChanges = operation.resolve(testSchema.id);
    schemaChanges.adds = changes.adds ?? [];
    schemaChanges.removes = changes.removes ?? [];
    plugin.bulkPersist({
        id: uuid(8), schemas: buildSchemas(), source: 'repro', action: 'persist', operation,
    }, (result) => result.ok === Result.ERROR ? reject(result.error) : resolve(result.data));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('--- Repro 1: write before first query blocks hydration ---');
{
    const source = new MemoryPlugin(`repro1-${uuid(8)}`);
    await persist(source, { adds: [{ name: 'Pre-existing A' }, { name: 'Pre-existing B' }] });

    const plugin = new OptimisticUpdatesDbPlugin(source);
    await persist(plugin, { adds: [{ name: 'New write' }] });

    const rows = await queryRows(plugin);
    const sourceRows = await queryRows(source);
    console.log(`source holds ${sourceRows.length} rows; plugin read returns ${rows.length}:`, rows.map((r) => r.name));
    console.log(rows.length === sourceRows.length ? 'OK' : 'BUG: pre-existing rows invisible');
}

console.log('--- Repro 2: remove during in-flight hydration resurrects the row ---');
{
    const source = new MemoryPlugin(`repro2-${uuid(8)}`);
    await persist(source, { adds: [{ name: 'Doomed' }] });

    const slowSource = {
        get databaseName() { return source.databaseName; },
        query: (event, done) => { source.query(event, (result) => setTimeout(() => done(result), 100)); },
        bulkPersist: (event, done) => source.bulkPersist(event, done),
        destroy: (event, done) => source.destroy(event, done),
    };

    const plugin = new OptimisticUpdatesDbPlugin(slowSource);

    const hydratingRead = queryRows(plugin);
    await sleep(20);
    const [doomed] = await queryRows(source);
    await persist(plugin, { removes: [doomed] });

    await hydratingRead;
    await sleep(150);
    const rows = await queryRows(plugin);
    console.log(`after remove-during-hydration, plugin read returns ${rows.length}:`, rows.map((r) => r.name));
    console.log(rows.length === 0 ? 'OK' : 'BUG: removed row resurrected');
}
