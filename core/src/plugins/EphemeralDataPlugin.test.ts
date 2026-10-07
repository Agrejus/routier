import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EphemeralDataPlugin } from './EphemeralDataPlugin';
import { CompiledSchema, InferType, s } from '../schema';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection, MemoryDataCollection } from '../collections';
import { Result } from '../results';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent } from './types';
import { QueryOptionsCollection } from './query/QueryOptionsCollection';
import { Query } from './query/Query';
import { toExpression } from '../expressions';

// Test schema
const testSchema = s.define("test", {
    id: s.string().key().identity(),
    name: s.string(),
    value: s.number().default(0)
}).compile();

type TestEntity = InferType<typeof testSchema>;

// Concrete implementation for testing
class UnreadableCollection extends MemoryDataCollection {
    override load(done: Parameters<MemoryDataCollection["load"]>[0]) {
        done(Result.error(new Error("unreadable")));
    }
}

class TestEphemeralDataPlugin extends EphemeralDataPlugin {
    private collections = new Map<string, MemoryDataCollection>();

    constructor(private readonly unreadable = false) {
        super('test-database');
    }

    protected resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection {
        const schemaId = String(schema.id);
        if (!this.collections.has(schemaId)) {
            this.collections.set(schemaId, this.unreadable ? new UnreadableCollection(schema) : new MemoryDataCollection(schema));
        }
        return this.collections.get(schemaId)!;
    }

    destroy(event: DbPluginEvent, done: any): void {
        this.collections.clear();
        done(Result.success());
    }

    // Helper method to get collection for testing
    getCollection(schemaId: string): MemoryDataCollection {
        return this.collections.get(schemaId)!;
    }
}

describe('EphemeralDataPlugin', () => {
    let plugin: TestEphemeralDataPlugin;
    let schemas: SchemaCollection;

    beforeEach(() => {
        plugin = new TestEphemeralDataPlugin();
        schemas = new SchemaCollection();
        schemas.set(testSchema.id, testSchema);
    });

    afterEach(() => {
        plugin.destroy({ id: 'test' } as DbPluginEvent, () => { });
    });

    describe('bulkPersist', () => {
        it('should handle empty operation', (done) => {
            const operation = new BulkPersistChanges();
            const event: DbPluginBulkPersistEvent = {
                id: 'test-event',
                operation,
                schemas,
                source: 'EphemeralDataPlugin',
                action: "persist"
            };

            plugin.bulkPersist(event, (result) => {
                expect(result.ok).toBe('success');
                done();
            });
        });

        it('should add items successfully', (done) => {
            const operation = new BulkPersistChanges();
            const schemaId = testSchema.id;
            const changes = operation.resolve(schemaId);

            // Add items directly to the changes
            changes.adds.push(
                { name: 'Item 1', value: 10 } as any,
                { name: 'Item 2', value: 20 } as any
            );

            const event: DbPluginBulkPersistEvent = {
                id: 'test-event',
                operation,
                schemas,
                source: 'EphemeralDataPlugin',
                action: "persist"
            };

            plugin.bulkPersist(event, (result) => {
                expect(result.ok).toBe('success');

                if (result.ok === 'success' && 'data' in result) {
                    const bulkResult = result.data as BulkPersistResult;
                    const schemaResult = bulkResult.get(schemaId);
                    expect(schemaResult.adds).toHaveLength(2);
                    expect(schemaResult.adds[0].name).toBe('Item 1');
                    expect(schemaResult.adds[1].name).toBe('Item 2');

                    // Verify items were actually added to collection
                    const collection = plugin.getCollection(String(schemaId));
                    expect(collection.records).toHaveLength(2);
                }
                done();
            });
        });

        it('should handle errors gracefully', (done) => {
            // Create an operation with a schema that doesn't exist in our schemas collection
            const operation = new BulkPersistChanges();
            const changes = operation.resolve('non-existent-schema' as any);
            changes.adds.push({ name: 'Item 1' } as any);

            const event: DbPluginBulkPersistEvent = {
                id: 'test-event',
                operation,
                schemas, // This doesn't contain 'non-existent-schema'
                source: 'EphemeralDataPlugin',
                action: "persist"
            };

            plugin.bulkPersist(event, (result) => {
                expect(result.ok).toBe('error');
                done();
            });
        });
    });

    describe('destroy', () => {
        it('should clear all collections', (done) => {
            // Add some data first
            const operation = new BulkPersistChanges();
            const schemaId = testSchema.id;
            const changes = operation.resolve(schemaId);
            changes.adds.push({ name: 'Item 1', value: 10 } as any);

            const event: DbPluginBulkPersistEvent = {
                id: 'test-event',
                operation,
                schemas,
                source: 'EphemeralDataPlugin',
                action: "persist"
            };

            plugin.bulkPersist(event, (result) => {
                expect(result.ok).toBe('success');

                // Verify data exists
                const collection = plugin.getCollection(String(schemaId));
                expect(collection.records).toHaveLength(1);

                // Destroy and verify collections are cleared
                plugin.destroy({ id: 'destroy-event' } as DbPluginEvent, (destroyResult: any) => {
                    expect(destroyResult.ok).toBe('success');
                    // After destroy, the collection should be cleared but still exist
                    const collection = plugin.getCollection(String(schemaId));
                    expect(collection).toBeUndefined()
                    done();
                });
            });
        });
    });

    describe('reading before a write', () => {
        const persistEvent = (build: (changes: ReturnType<BulkPersistChanges["resolve"]>) => void): DbPluginBulkPersistEvent => {
            const operation = new BulkPersistChanges();
            build(operation.resolve(testSchema.id));

            return { id: 'test-event', operation, schemas, source: 'EphemeralDataPlugin', action: "persist" };
        };

        const persist = (target: TestEphemeralDataPlugin, event: DbPluginBulkPersistEvent) =>
            new Promise<string>(resolve => target.bulkPersist(event, result => resolve(result.ok)));

        it('fails an update when the stored collection cannot be read', async () => {
            const unreadable = new TestEphemeralDataPlugin(true);
            const entity = { id: 'a', name: 'Item', value: 1 };
            const ok = await persist(unreadable, persistEvent(changes => changes.updates.push({ entity, delta: { name: 'Item' } } as never)));

            expect(ok).toBe('error');
        });

        it('fails a remove when the stored collection cannot be read', async () => {
            const unreadable = new TestEphemeralDataPlugin(true);
            const ok = await persist(unreadable, persistEvent(changes => changes.removes.push({ id: 'a', name: 'Item', value: 1 } as never)));

            expect(ok).toBe('error');
        });

        it('adds without reading the stored collection', async () => {
            const unreadable = new TestEphemeralDataPlugin(true);
            const ok = await persist(unreadable, persistEvent(changes => changes.adds.push({ id: 'a', name: 'Item', value: 1 } as never)));

            expect(ok).toBe('success');
        });
    });

    describe('query reporting', () => {
        const queryWith = (build: (options: QueryOptionsCollection<TestEntity>) => void) => {
            const options = new QueryOptionsCollection<TestEntity>();
            build(options);

            const event: DbPluginQueryEvent<TestEntity, TestEntity> = {
                id: 'q',
                operation: new Query(options, testSchema) as never,
                schemas,
                source: 'test',
                action: 'query',
                explain: true,
                executedQueries: []
            };

            return new Promise<DbPluginQueryEvent<TestEntity, TestEntity>["executedQueries"]>(resolve =>
                plugin.query(event, () => resolve(event.executedQueries)));
        };

        it('reports only the filters it executed', async () => {
            const executed = await queryWith(options => {
                const byName = (x: TestEntity) => x.name === "Item 1";
                options.add("filter", { filter: byName, expression: toExpression(testSchema, byName), params: undefined } as never);
                options.add("take", 1);
                const byValue = (x: TestEntity) => x.value > 5;
                options.add("filter", { filter: byValue, expression: toExpression(testSchema, byValue), params: undefined } as never);
            });

            expect(executed).toStrictEqual([{ text: 'test: scanned 0 in-memory records, filter name === ?', parameters: ["Item 1"] }]);
        });
    });
});
