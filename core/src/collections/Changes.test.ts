import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
    CollectionChanges,
    CollectionChangesResult,
    PendingChanges,
    ResolvedChanges,
} from './Changes';
import { SchemaId } from '../schema';
import { EntityUpdateInfo, EntityChangeType } from '../plugins';
import { BasicDataStoreFactory } from '../../../tests/src/contexts/BasicDataStoreFactory';
import { product } from '../../../tests/src/schemas/product';
import { generateData } from '../../../tests/src/data/generator';

// Test entity type for testing changes
type TestEntity = any;

describe('CollectionChanges', () => {
    let changes: CollectionChanges<TestEntity>;

    beforeEach(() => {
        changes = new CollectionChanges<TestEntity>();
    });

    describe('constructor', () => {
        it('should create empty changes by default', () => {
            expect(changes.adds.entities).toEqual([]);
            expect(changes.updates.changes).toEqual([]);
            expect(changes.removes.entities).toEqual([]);
            expect(changes.hasChanges).toBe(false);
        });

        it('should create changes with provided data', () => {
            const testAdds = [{ name: 'test', value: 1 }];
            const testUpdates: EntityUpdateInfo<TestEntity>[] = [{
                entity: { id: '1', name: 'test', value: 1 },
                changeType: 'propertiesChanged' as EntityChangeType,
                delta: { name: 'updated' }
            }];
            const testRemoves = [{ id: '1', name: 'test', value: 1 }];

            const changesWithData = new CollectionChanges<TestEntity>({
                adds: { entities: testAdds },
                updates: { changes: testUpdates },
                removes: { entities: testRemoves }
            });

            expect(changesWithData.adds.entities).toEqual(testAdds);
            expect(changesWithData.updates.changes).toEqual(testUpdates);
            expect(changesWithData.removes.entities).toEqual(testRemoves);
            expect(changesWithData.hasChanges).toBe(true);
        });
    });

    describe('EMPTY', () => {
        it('should create empty changes', () => {
            const empty = CollectionChanges.EMPTY<TestEntity>();
            expect(empty.adds.entities).toEqual([]);
            expect(empty.updates.changes).toEqual([]);
            expect(empty.removes.entities).toEqual([]);
            expect(empty.hasChanges).toBe(false);
        });
    });

    describe('combine', () => {
        it('should combine changes from another CollectionChanges', () => {
            const otherChanges = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'other', value: 2 }] },
                updates: {
                    changes: [{
                        entity: { id: '1', name: 'test', value: 1 },
                        changeType: 'propertiesChanged' as EntityChangeType,
                        delta: { name: 'updated' }
                    }]
                },
                removes: { entities: [{ id: '2', name: 'removed', value: 3 }] }
            });

            changes.combine(otherChanges);

            expect(changes.adds.entities).toHaveLength(1);
            expect(changes.updates.changes).toHaveLength(1);
            expect(changes.removes.entities).toHaveLength(1);
            expect(changes.hasChanges).toBe(true);
        });

        it('should combine with empty changes', () => {
            const emptyChanges = CollectionChanges.EMPTY<TestEntity>();

            changes.combine(emptyChanges);

            expect(changes.adds.entities).toEqual([]);
            expect(changes.updates.changes).toEqual([]);
            expect(changes.removes.entities).toEqual([]);
            expect(changes.hasChanges).toBe(false);
        });
    });

    describe('hasChanges', () => {
        it('should return false when no changes', () => {
            expect(changes.hasChanges).toBe(false);
        });

        it('should return true when has adds', () => {
            changes.adds.entities.push({ name: 'test', value: 1 });
            expect(changes.hasChanges).toBe(true);
        });

        it('should return true when has updates', () => {
            changes.updates.changes.push({
                entity: { id: '1', name: 'test', value: 1 },
                changeType: 'propertiesChanged' as EntityChangeType,
                delta: { name: 'updated' }
            });
            expect(changes.hasChanges).toBe(true);
        });

        it('should return true when has removes', () => {
            changes.removes.entities.push({ id: '1', name: 'test', value: 1 });
            expect(changes.hasChanges).toBe(true);
        });
    });
});

describe('CollectionChangesResult', () => {
    let result: CollectionChangesResult<TestEntity>;

    beforeEach(() => {
        result = new CollectionChangesResult<TestEntity>();
    });

    describe('constructor', () => {
        it('should create empty result by default', () => {
            expect(result.adds.entities).toEqual([]);
            expect(result.updates.entities).toEqual([]);
            expect(result.removes.entities).toEqual([]);
            expect(result.hasChanges).toBe(false);
        });
    });

    describe('EMPTY', () => {
        it('should create empty result', () => {
            const empty = CollectionChangesResult.EMPTY<TestEntity>();
            expect(empty.adds.entities).toEqual([]);
            expect(empty.updates.entities).toEqual([]);
            expect(empty.removes.entities).toEqual([]);
            expect(empty.hasChanges).toBe(false);
        });
    });

    describe('combine', () => {
        it('should combine results from another CollectionChangesResult', () => {
            const otherResult = new CollectionChangesResult<TestEntity>();
            otherResult.adds.entities.push({ name: 'other', value: 2 });
            otherResult.updates.entities.push({ id: '1', name: 'updated', value: 1 });
            otherResult.removes.entities.push({ id: '2', name: 'removed', value: 3 });

            result.combine(otherResult);

            expect(result.adds.entities).toHaveLength(1);
            expect(result.updates.entities).toHaveLength(1);
            expect(result.removes.entities).toHaveLength(1);
            expect(result.hasChanges).toBe(true);
        });

        it('should combine with empty result', () => {
            const emptyResult = CollectionChangesResult.EMPTY<TestEntity>();

            result.combine(emptyResult);

            expect(result.adds.entities).toEqual([]);
            expect(result.updates.entities).toEqual([]);
            expect(result.removes.entities).toEqual([]);
            expect(result.hasChanges).toBe(false);
        });
    });

    describe('hasChanges', () => {
        it('should return false when no changes', () => {
            expect(result.hasChanges).toBe(false);
        });

        it('should return true when has adds', () => {
            result.adds.entities.push({ name: 'test', value: 1 });
            expect(result.hasChanges).toBe(true);
        });

        it('should return true when has updates', () => {
            result.updates.entities.push({ id: '1', name: 'test', value: 1 });
            expect(result.hasChanges).toBe(true);
        });

        it('should return true when has removes', () => {
            result.removes.entities.push({ id: '1', name: 'test', value: 1 });
            expect(result.hasChanges).toBe(true);
        });
    });
});

describe('PendingChanges', () => {
    let pendingChanges: PendingChanges<TestEntity>;

    beforeEach(() => {
        pendingChanges = new PendingChanges<TestEntity>();
    });

    describe('constructor', () => {
        it('should create empty pending changes by default', () => {
            expect(pendingChanges.changes.schemaIds.size).toBe(0);
        });

        it('should create pending changes with provided data', () => {
            const data = new Map<SchemaId, { changes: CollectionChanges<TestEntity> }>();
            const schemaId = 'test-schema' as unknown as SchemaId;
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'test', value: 1 }] }
            });
            data.set(schemaId, { changes });

            const pendingWithData = new PendingChanges<TestEntity>(data);
            expect(pendingWithData.changes.schemaIds.has(schemaId)).toBe(true);
        });
    });

    describe('changes', () => {
        it('should provide access to ChangeSet', () => {
            expect(pendingChanges.changes).toBeDefined();
            expect(typeof pendingChanges.changes.set).toBe('function');
            expect(typeof pendingChanges.changes.get).toBe('function');
        });
    });

    describe('toResult', () => {
        it('should convert to ResolvedChanges with empty results', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'test', value: 1 }] }
            });

            pendingChanges.changes.set(schemaId, changes);
            const resolved = pendingChanges.toResult();

            expect(resolved).toBeInstanceOf(ResolvedChanges);
            expect(resolved.result.get(schemaId)).toBeDefined();
            expect(resolved.result.get(schemaId)?.hasChanges).toBe(false);
        });

        it('should create ResolvedChanges with both changes and result properties', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'test', value: 1 }] },
                updates: {
                    changes: [{
                        entity: { id: '1', name: 'test', value: 1 },
                        changeType: 'propertiesChanged' as EntityChangeType,
                        delta: { name: 'updated' }
                    }]
                },
                removes: { entities: [{ id: '2', name: 'removed', value: 2 }] }
            });

            pendingChanges.changes.set(schemaId, changes);
            const resolved = pendingChanges.toResult();

            expect(resolved).toBeInstanceOf(ResolvedChanges);
            expect(resolved.changes).toBeDefined();
            expect(resolved.result).toBeDefined();
            expect(typeof resolved.changes.set).toBe('function');
            expect(typeof resolved.changes.get).toBe('function');
            expect(typeof resolved.result.set).toBe('function');
            expect(typeof resolved.result.get).toBe('function');
            expect(resolved.changes.get(schemaId)).toBe(changes);
            expect(resolved.result.get(schemaId)).toBeDefined();
            expect(resolved.result.get(schemaId)?.hasChanges).toBe(false);
        });
    });
});

describe('ResolvedChanges', () => {
    let resolvedChanges: ResolvedChanges<TestEntity>;

    beforeEach(() => {
        resolvedChanges = new ResolvedChanges<TestEntity>();
    });

    describe('constructor', () => {
        it('should create empty resolved changes by default', () => {
            expect(resolvedChanges.changes.schemaIds.size).toBe(0);
            expect(resolvedChanges.result).toBeDefined();
        });

        it('should create resolved changes with provided data', () => {
            const data = new Map<SchemaId, {
                changes: CollectionChanges<TestEntity>,
                result: CollectionChangesResult<TestEntity>
            }>();
            const schemaId = 'test-schema' as unknown as SchemaId;
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'test', value: 1 }] }
            });
            const result = new CollectionChangesResult<TestEntity>();
            data.set(schemaId, { changes, result });

            const resolvedWithData = new ResolvedChanges<TestEntity>(data);
            expect(resolvedWithData.changes.schemaIds.has(schemaId)).toBe(true);
            expect(resolvedWithData.result.get(schemaId)).toBe(result);
        });
    });

    describe('result', () => {
        it('should provide access to ResultSet', () => {
            expect(resolvedChanges.result).toBeDefined();
            expect(typeof resolvedChanges.result.set).toBe('function');
            expect(typeof resolvedChanges.result.get).toBe('function');
        });
    });
});

describe('ChangeSet', () => {
    let changeSet: any; // Using any to access the ChangeSet class
    let data: Map<SchemaId, { changes: CollectionChanges<TestEntity> }>;

    beforeEach(() => {
        data = new Map();
        // Access the ChangeSet class through PendingChanges
        const pendingChanges = new PendingChanges<TestEntity>(data);
        changeSet = pendingChanges.changes;
    });

    describe('set and get', () => {
        it('should set and get changes for a schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'test', value: 1 }] }
            });

            changeSet.set(schemaId, changes);
            const retrieved = changeSet.get(schemaId);

            expect(retrieved).toBe(changes);
            expect(changeSet.schemaIds.has(schemaId)).toBe(true);
        });

        it('should return undefined for non-existent schema', () => {
            const schemaId = 'non-existent' as unknown as SchemaId;
            const retrieved = changeSet.get(schemaId);
            expect(retrieved).toBeUndefined();
        });
    });

    describe('adds', () => {
        it('should return adds for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const testAdds = [{ name: 'test', value: 1 }];
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: testAdds }
            });

            changeSet.set(schemaId, changes);
            const result = changeSet.adds(schemaId);

            expect(result.data).toEqual(testAdds);
            expect(result.getTags).toBeDefined();
        });

        it('should return adds for multiple schemas', () => {
            const schemaId1 = 'schema1' as unknown as SchemaId;
            const schemaId2 = 'schema2' as unknown as SchemaId;
            const testAdds1 = [{ name: 'test1', value: 1 }];
            const testAdds2 = [{ name: 'test2', value: 2 }];

            changeSet.set(schemaId1, new CollectionChanges<TestEntity>({ adds: { entities: testAdds1 } }));
            changeSet.set(schemaId2, new CollectionChanges<TestEntity>({ adds: { entities: testAdds2 } }));

            const result = changeSet.adds([schemaId1, schemaId2]);

            expect(result.data).toHaveLength(2);
            expect(result.data).toEqual(expect.arrayContaining([
                [schemaId1, testAdds1[0]],
                [schemaId2, testAdds2[0]]
            ]));
        });

        it('should return all adds when no schema specified', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const testAdds = [{ name: 'test', value: 1 }];
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: testAdds }
            });

            changeSet.set(schemaId, changes);
            const result = changeSet.adds();

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toEqual([schemaId, testAdds[0]]);
        });
    });

    describe('updates', () => {
        it('should return updates for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const testUpdates: EntityUpdateInfo<TestEntity>[] = [{
                entity: { id: '1', name: 'test', value: 1 },
                changeType: 'propertiesChanged' as EntityChangeType,
                delta: { name: 'updated' }
            }];
            const changes = new CollectionChanges<TestEntity>({
                updates: { changes: testUpdates }
            });

            changeSet.set(schemaId, changes);
            const result = changeSet.updates(schemaId);

            expect(result.data).toEqual(testUpdates);
            expect(result.getTags).toBeDefined();
        });
    });

    describe('removes', () => {
        it('should return removes for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const testRemoves = [{ id: '1', name: 'test', value: 1 }];
            const changes = new CollectionChanges<TestEntity>({
                removes: { entities: testRemoves }
            });

            changeSet.set(schemaId, changes);
            const result = changeSet.removes(schemaId);

            expect(result.data).toEqual(testRemoves);
            expect(result.getTags).toBeDefined();
        });
    });

    describe('all', () => {
        it('should return all changes for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const testAdds = [{ name: 'test', value: 1 }];
            const testUpdates: EntityUpdateInfo<TestEntity>[] = [{
                entity: { id: '1', name: 'test', value: 1 },
                changeType: 'propertiesChanged' as EntityChangeType,
                delta: { name: 'updated' }
            }];
            const testRemoves = [{ id: '1', name: 'test', value: 1 }];

            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: testAdds },
                updates: { changes: testUpdates },
                removes: { entities: testRemoves }
            });

            changeSet.set(schemaId, changes);
            const result = changeSet.all(schemaId);

            expect(result.data).toHaveLength(3);
            expect(result.data).toEqual(expect.arrayContaining([
                { entity: testAdds[0] },
                { changes: testUpdates[0] },
                { entity: testRemoves[0] }
            ]));
        });

        it('should return all changes across all schemas', () => {
            const schemaId1 = 'schema1' as unknown as SchemaId;
            const schemaId2 = 'schema2' as unknown as SchemaId;
            const testAdds1 = [{ name: 'test1', value: 1 }];
            const testAdds2 = [{ name: 'test2', value: 2 }];

            changeSet.set(schemaId1, new CollectionChanges<TestEntity>({ adds: { entities: testAdds1 } }));
            changeSet.set(schemaId2, new CollectionChanges<TestEntity>({ adds: { entities: testAdds2 } }));

            const result = changeSet.all();

            expect(result.data).toHaveLength(2);
            expect(result.data).toEqual(expect.arrayContaining([
                [schemaId1, { entity: testAdds1[0] }],
                [schemaId2, { entity: testAdds2[0] }]
            ]));
        });
    });
});

describe('ResultSet', () => {
    let resultSet: any; // Using any to access the ResultSet class
    let data: Map<SchemaId, {
        changes: CollectionChanges<TestEntity>,
        result: CollectionChangesResult<TestEntity>
    }>;

    beforeEach(() => {
        data = new Map();
        // Access the ResultSet class through ResolvedChanges
        const resolvedChanges = new ResolvedChanges<TestEntity>(data);
        resultSet = resolvedChanges.result;
    });

    describe('set and get', () => {
        it('should set and get results for a schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const result = new CollectionChangesResult<TestEntity>();
            result.adds.entities.push({ name: 'test', value: 1 });

            resultSet.set(schemaId, result);
            const retrieved = resultSet.get(schemaId);

            expect(retrieved).toBe(result);
            expect(resultSet.schemaIds.has(schemaId)).toBe(true);
        });

        it('should return undefined for non-existent schema', () => {
            const schemaId = 'non-existent' as unknown as SchemaId;
            const retrieved = resultSet.get(schemaId);
            expect(retrieved).toBeUndefined();
        });
    });

    describe('adds', () => {
        it('should return adds for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const result = new CollectionChangesResult<TestEntity>();
            const testAdds = [{ name: 'test', value: 1 }];
            result.adds.entities.push(...testAdds);

            resultSet.set(schemaId, result);
            const retrieved = resultSet.adds(schemaId);

            expect(retrieved.data).toEqual(testAdds);
        });

        it('should return adds for multiple schemas', () => {
            const schemaId1 = 'schema1' as unknown as SchemaId;
            const schemaId2 = 'schema2' as unknown as SchemaId;
            const result1 = new CollectionChangesResult<TestEntity>();
            const result2 = new CollectionChangesResult<TestEntity>();
            const testAdds1 = [{ name: 'test1', value: 1 }];
            const testAdds2 = [{ name: 'test2', value: 2 }];

            result1.adds.entities.push(...testAdds1);
            result2.adds.entities.push(...testAdds2);

            resultSet.set(schemaId1, result1);
            resultSet.set(schemaId2, result2);

            const retrieved = resultSet.adds([schemaId1, schemaId2]);

            expect(retrieved.data).toHaveLength(2);
            expect(retrieved.data).toEqual(expect.arrayContaining([
                [schemaId1, testAdds1[0]],
                [schemaId2, testAdds2[0]]
            ]));
        });
    });

    describe('updates', () => {
        it('should return updates for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const result = new CollectionChangesResult<TestEntity>();
            const testUpdates = [{ id: '1', name: 'test', value: 1 }];
            result.updates.entities.push(...testUpdates);

            resultSet.set(schemaId, result);
            const retrieved = resultSet.updates(schemaId);

            expect(retrieved.data).toEqual(testUpdates);
        });
    });

    describe('removes', () => {
        it('should return removes for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const result = new CollectionChangesResult<TestEntity>();
            const testRemoves = [{ id: '1', name: 'test', value: 1 }];
            result.removes.entities.push(...testRemoves);

            resultSet.set(schemaId, result);
            const retrieved = resultSet.removes(schemaId);

            expect(retrieved.data).toEqual(testRemoves);
        });
    });

    describe('all', () => {
        it('should return all results for specific schema', () => {
            const schemaId = 'test-schema' as unknown as SchemaId;
            const result = new CollectionChangesResult<TestEntity>();
            const testAdds = [{ name: 'test', value: 1 }];
            const testUpdates = [{ id: '1', name: 'test', value: 1 }];
            const testRemoves = [{ id: '2', name: 'removed', value: 2 }];

            result.adds.entities.push(...testAdds);
            result.updates.entities.push(...testUpdates);
            result.removes.entities.push(...testRemoves);

            resultSet.set(schemaId, result);
            const retrieved = resultSet.all(schemaId);

            expect(retrieved.data).toHaveLength(3);
            expect(retrieved.data).toEqual(expect.arrayContaining([
                testAdds[0],
                testUpdates[0],
                testRemoves[0]
            ]));
        });

        it('should return all results across all schemas', () => {
            const schemaId1 = 'schema1' as unknown as SchemaId;
            const schemaId2 = 'schema2' as unknown as SchemaId;
            const result1 = new CollectionChangesResult<TestEntity>();
            const result2 = new CollectionChangesResult<TestEntity>();
            const testAdds1 = [{ name: 'test1', value: 1 }];
            const testAdds2 = [{ name: 'test2', value: 2 }];

            result1.adds.entities.push(...testAdds1);
            result2.adds.entities.push(...testAdds2);

            resultSet.set(schemaId1, result1);
            resultSet.set(schemaId2, result2);

            const retrieved = resultSet.all();

            expect(retrieved.data).toHaveLength(2);
            expect(retrieved.data).toEqual(expect.arrayContaining([
                [schemaId1, testAdds1[0]],
                [schemaId2, testAdds2[0]]
            ]));
        });
    });
});

describe('Edge Cases and Error Handling', () => {
    describe('CollectionChanges', () => {
        it('should handle null/undefined constructor parameters', () => {
            const changes = new CollectionChanges<TestEntity>({
                adds: undefined,
                updates: undefined,
                removes: undefined
            });

            expect(changes.adds.entities).toEqual([]);
            expect(changes.updates.changes).toEqual([]);
            expect(changes.removes.entities).toEqual([]);
        });

        it('should handle empty arrays in constructor', () => {
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: [] },
                updates: { changes: [] },
                removes: { entities: [] }
            });

            expect(changes.adds.entities).toEqual([]);
            expect(changes.updates.changes).toEqual([]);
            expect(changes.removes.entities).toEqual([]);
            expect(changes.hasChanges).toBe(false);
        });
    });

    describe('ChangeSet', () => {
        it('should handle empty data map', () => {
            const emptyData = new Map<SchemaId, { changes: CollectionChanges<TestEntity> }>();
            const pendingChanges = new PendingChanges<TestEntity>(emptyData);
            const changeSet = pendingChanges.changes;

            expect(changeSet.adds().data).toEqual([]);
            expect(changeSet.updates().data).toEqual([]);
            expect(changeSet.removes().data).toEqual([]);
            expect(changeSet.all().data).toEqual([]);
        });

        it('should handle non-existent schema IDs', () => {
            const data = new Map<SchemaId, { changes: CollectionChanges<TestEntity> }>();
            const pendingChanges = new PendingChanges<TestEntity>(data);
            const changeSet = pendingChanges.changes;

            const nonExistentId = 'non-existent' as unknown as SchemaId;
            expect(changeSet.adds(nonExistentId).data).toEqual([]);
            expect(changeSet.updates(nonExistentId).data).toEqual([]);
            expect(changeSet.removes(nonExistentId).data).toEqual([]);
        });
    });

    describe('ResultSet', () => {
        it('should handle empty data map', () => {
            const emptyData = new Map<SchemaId, {
                changes: CollectionChanges<TestEntity>,
                result: CollectionChangesResult<TestEntity>
            }>();
            const resolvedChanges = new ResolvedChanges<TestEntity>(emptyData);
            const resultSet = resolvedChanges.result;

            expect(resultSet.adds().data).toEqual([]);
            expect(resultSet.updates().data).toEqual([]);
            expect(resultSet.removes().data).toEqual([]);
            expect(resultSet.all().data).toEqual([]);
        });

        it('should handle non-existent schema IDs', () => {
            const data = new Map<SchemaId, {
                changes: CollectionChanges<TestEntity>,
                result: CollectionChangesResult<TestEntity>
            }>();
            const resolvedChanges = new ResolvedChanges<TestEntity>(data);
            const resultSet = resolvedChanges.result;

            const nonExistentId = 'non-existent' as unknown as SchemaId;
            expect(resultSet.adds(nonExistentId).data).toEqual([]);
            expect(resultSet.updates(nonExistentId).data).toEqual([]);
            expect(resultSet.removes(nonExistentId).data).toEqual([]);
        });
    });
});

describe('Integration Tests', () => {
    describe('Complete workflow', () => {
        it('should handle complete change workflow', () => {
            // Create pending changes
            const pendingChanges = new PendingChanges<TestEntity>();
            const schemaId = 'test-schema' as unknown as SchemaId;

            // Add some changes
            const changes = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'new', value: 1 }] },
                updates: {
                    changes: [{
                        entity: { id: '1', name: 'existing', value: 1 },
                        changeType: 'propertiesChanged' as EntityChangeType,
                        delta: { name: 'updated' }
                    }]
                },
                removes: { entities: [{ id: '2', name: 'removed', value: 2 }] }
            });

            pendingChanges.changes.set(schemaId, changes);

            // Convert to resolved changes
            const resolvedChanges = pendingChanges.toResult();

            // Verify the structure
            expect(resolvedChanges.changes.get(schemaId)).toBe(changes);
            expect(resolvedChanges.result.get(schemaId)).toBeDefined();
            expect(resolvedChanges.result.get(schemaId)?.hasChanges).toBe(false);

            // Set some results
            const result = new CollectionChangesResult<TestEntity>();
            result.adds.entities.push({ name: 'new', value: 1 });
            result.updates.entities.push({ id: '1', name: 'updated', value: 1 });
            result.removes.entities.push({ id: '2', name: 'removed', value: 2 });

            resolvedChanges.result.set(schemaId, result);

            // Verify results
            expect(resolvedChanges.result.adds(schemaId).data).toHaveLength(1);
            expect(resolvedChanges.result.updates(schemaId).data).toHaveLength(1);
            expect(resolvedChanges.result.removes(schemaId).data).toHaveLength(1);
            expect(resolvedChanges.result.all(schemaId).data).toHaveLength(3);
        });
    });

    describe('Multiple schemas', () => {
        it('should handle multiple schemas correctly', () => {
            const pendingChanges = new PendingChanges<TestEntity>();
            const schemaId1 = 'schema1' as unknown as SchemaId;
            const schemaId2 = 'schema2' as unknown as SchemaId;

            // Set changes for multiple schemas
            const changes1 = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'schema1', value: 1 }] }
            });
            const changes2 = new CollectionChanges<TestEntity>({
                adds: { entities: [{ name: 'schema2', value: 2 }] }
            });

            pendingChanges.changes.set(schemaId1, changes1);
            pendingChanges.changes.set(schemaId2, changes2);

            // Convert to resolved changes
            const resolvedChanges = pendingChanges.toResult();

            // Set results for both schemas
            const result1 = new CollectionChangesResult<TestEntity>();
            const result2 = new CollectionChangesResult<TestEntity>();
            result1.adds.entities.push({ name: 'schema1', value: 1 });
            result2.adds.entities.push({ name: 'schema2', value: 2 });

            resolvedChanges.result.set(schemaId1, result1);
            resolvedChanges.result.set(schemaId2, result2);

            // Verify results across schemas
            const allAdds = resolvedChanges.result.adds();
            expect(allAdds.data).toHaveLength(2);
            expect(allAdds.data).toEqual(expect.arrayContaining([
                [schemaId1, { name: 'schema1', value: 1 }],
                [schemaId2, { name: 'schema2', value: 2 }]
            ]));
        });
    });
});

describe('Real-world scenarios with DataStore', () => {
    const factory = BasicDataStoreFactory.create();

    afterAll(async () => {
        await factory.cleanup();
    });

    describe('Changes with actual data', () => {
        it('should track changes when adding products', factory.createDataStore(async (dataStore) => {
            // Arrange
            const [item] = generateData(product, 1);

            // Act
            const [added] = await dataStore.products.addAsync(item);
            const response = await dataStore.saveChangesAsync();

            // Assert
            expect(added._id).toStrictEqual(expect.any(String));
            expect(added.category).toBe(item.category);
            expect(added.name).toBe(item.name);
            expect(added.inStock).toBe(item.inStock);
            expect(added.price).toBe(item.price);
            expect(added.tags).toEqual(item.tags);
        }));

        it('should track changes when removing products', factory.createDataStore(async (dataStore) => {
            // Arrange
            await dataStore.products.addAsync(...generateData(product, 2));
            await dataStore.saveChangesAsync();

            // Act
            const found = await dataStore.products.firstAsync();
            await dataStore.products.removeAsync(found);
            await dataStore.saveChangesAsync();

            // Assert
            const all = await dataStore.products.toArrayAsync();
            expect(all.length).toBe(1);
        }));

        it('should track changes when updating products', factory.createDataStore(async (dataStore) => {
            // Arrange
            await dataStore.products.addAsync(...generateData(product, 2));
            await dataStore.saveChangesAsync();

            // Act
            const found = await dataStore.products.firstAsync();
            const originalName = found.name;
            found.name = 'Updated Product Name';
            await dataStore.saveChangesAsync();

            // Assert
            const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);
            expect(foundAfterSave.name).toBe('Updated Product Name');
            expect(foundAfterSave.name).not.toBe(originalName);
        }));
    });
}); 