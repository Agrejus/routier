import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EphemeralDataPlugin } from './EphemeralDataPlugin';
import { CompiledSchema, s } from '../schema';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection, MemoryDataCollection } from '../collections';
import { Result } from '../results';
import { DbPluginBulkPersistEvent, DbPluginEvent } from './types';

// Test schema
const testSchema = s.define("test", {
    id: s.string().key().identity(),
    name: s.string(),
    value: s.number().default(0)
}).compile();

// Concrete implementation for testing
class TestEphemeralDataPlugin extends EphemeralDataPlugin {
    private collections = new Map<string, MemoryDataCollection>();

    constructor() {
        super('test-database');
    }

    protected resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection {
        const schemaId = String(schema.id);
        if (!this.collections.has(schemaId)) {
            this.collections.set(schemaId, new MemoryDataCollection(schema));
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
                source: 'data-store'
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
                source: 'data-store'
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
                source: 'data-store'
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
                source: 'data-store'
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
});