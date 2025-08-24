import { describe, it, expect, beforeEach } from 'vitest';
import { BulkPersistResult, BulkPersistChanges, SchemaPersistChanges, SchemaPersistResult } from './Changes';
import { TagCollection } from './TagCollection';

describe('SchemaPersistChanges', () => {
    let changes: SchemaPersistChanges;

    beforeEach(() => {
        changes = new SchemaPersistChanges();
    });

    describe('initialization', () => {
        it('should initialize with empty arrays and new TagCollection', () => {
            expect(changes.adds).toEqual([]);
            expect(changes.updates).toEqual([]);
            expect(changes.removes).toEqual([]);
            expect(changes.tags).toBeInstanceOf(TagCollection);
        });
    });

    describe('hasItems', () => {
        it('should return false when all arrays are empty', () => {
            expect(changes.hasItems).toBe(false);
        });

        it('should return true when adds has items', () => {
            changes.adds.push({ id: '1', name: 'Test' } as any);
            expect(changes.hasItems).toBe(true);
        });

        it('should return true when updates has items', () => {
            changes.updates.push({ entity: { id: '1' }, changeType: 'propertiesChanged', delta: {} } as any);
            expect(changes.hasItems).toBe(true);
        });

        it('should return true when removes has items', () => {
            changes.removes.push({ id: '1', name: 'Test' } as any);
            expect(changes.hasItems).toBe(true);
        });
    });

    describe('total', () => {
        it('should return 0 for empty changes', () => {
            expect(changes.total).toBe(0);
        });

        it('should return correct total with mixed items', () => {
            changes.adds.push({ id: '1' } as any);
            changes.adds.push({ id: '2' } as any);
            changes.updates.push({ entity: { id: '3' }, changeType: 'propertiesChanged', delta: {} } as any);
            changes.removes.push({ id: '4' } as any);

            expect(changes.total).toBe(4);
        });

        it('should handle large numbers correctly', () => {
            for (let i = 0; i < 1000; i++) {
                changes.adds.push({ id: i.toString() } as any);
            }
            expect(changes.total).toBe(1000);
        });
    });
});

describe('SchemaPersistResult', () => {
    let result: SchemaPersistResult;

    beforeEach(() => {
        result = new SchemaPersistResult();
    });

    describe('initialization', () => {
        it('should initialize with empty arrays', () => {
            expect(result.adds).toEqual([]);
            expect(result.updates).toEqual([]);
            expect(result.removes).toEqual([]);
        });
    });

    describe('hasItems', () => {
        it('should return false when all arrays are empty', () => {
            expect(result.hasItems).toBe(false);
        });

        it('should return true when adds has items', () => {
            result.adds.push({ id: '1', name: 'Test' } as any);
            expect(result.hasItems).toBe(true);
        });

        it('should return true when updates has items', () => {
            result.updates.push({ id: '1', name: 'Test' } as any);
            expect(result.hasItems).toBe(true);
        });

        it('should return true when removes has items', () => {
            result.removes.push({ id: '1', name: 'Test' } as any);
            expect(result.hasItems).toBe(true);
        });
    });

    describe('total', () => {
        it('should return 0 for empty result', () => {
            expect(result.total).toBe(0);
        });

        it('should return correct total with mixed items', () => {
            result.adds.push({ id: '1' } as any);
            result.adds.push({ id: '2' } as any);
            result.updates.push({ id: '3' } as any);
            result.removes.push({ id: '4' } as any);

            expect(result.total).toBe(4);
        });
    });
});

describe('BulkPersistResult', () => {
    let result: BulkPersistResult;

    beforeEach(() => {
        result = new BulkPersistResult();
    });

    describe('resolve', () => {
        it('should return existing result if schemaId exists', () => {
            const existingResult = new SchemaPersistResult();
            result.set(1, existingResult);

            const resolved = result.resolve(1);
            expect(resolved).toBe(existingResult);
        });

        it('should create and return new result if schemaId does not exist', () => {
            const resolved = result.resolve(1);
            expect(resolved).toBeInstanceOf(SchemaPersistResult);
            expect(result.has(1)).toBe(true);
        });

        it('should return the same instance when called multiple times', () => {
            const first = result.resolve(1);
            const second = result.resolve(1);
            expect(first).toBe(second);
        });
    });

    describe('get with generic type', () => {
        it('should return typed result', () => {
            const typedResult = result.get<{ id: string; name: string }>(1);
            expect(typedResult).toBeInstanceOf(SchemaPersistResult);
        });
    });

    describe('aggregate properties', () => {
        beforeEach(() => {
            // Setup test data
            const result1 = new SchemaPersistResult();
            result1.adds.push({ id: '1' } as any);
            result1.adds.push({ id: '2' } as any);
            result1.updates.push({ id: '3' } as any);
            result1.removes.push({ id: '4' } as any);

            const result2 = new SchemaPersistResult();
            result2.adds.push({ id: '5' } as any);
            result2.updates.push({ id: '6' } as any);

            result.set(1, result1);
            result.set(2, result2);
        });

        it('should calculate aggregate size correctly', () => {
            expect(result.aggregate.size).toBe(6); // 2+1+1+1+0+1
        });

        it('should calculate aggregate adds correctly', () => {
            expect(result.aggregate.adds).toBe(3); // 2+1
        });

        it('should calculate aggregate updates correctly', () => {
            expect(result.aggregate.updates).toBe(2); // 1+1
        });

        it('should calculate aggregate removes correctly', () => {
            expect(result.aggregate.removes).toBe(1); // 1+0
        });
    });

    describe('aggregate with empty results', () => {
        it('should return 0 for all aggregates when empty', () => {
            expect(result.aggregate.size).toBe(0);
            expect(result.aggregate.adds).toBe(0);
            expect(result.aggregate.updates).toBe(0);
            expect(result.aggregate.removes).toBe(0);
        });
    });
});

describe('BulkPersistChanges', () => {
    let changes: BulkPersistChanges;

    beforeEach(() => {
        changes = new BulkPersistChanges();
    });

    describe('resolve', () => {
        it('should return existing changes if schemaId exists', () => {
            const existingChanges = new SchemaPersistChanges();
            changes.set(1, existingChanges);

            const resolved = changes.resolve(1);
            expect(resolved).toBe(existingChanges);
        });

        it('should create and return new changes if schemaId does not exist', () => {
            const resolved = changes.resolve(1);
            expect(resolved).toBeInstanceOf(SchemaPersistChanges);
            expect(changes.has(1)).toBe(true);
        });

        it('should return the same instance when called multiple times', () => {
            const first = changes.resolve(1);
            const second = changes.resolve(1);
            expect(first).toBe(second);
        });
    });

    describe('get with generic type', () => {
        it('should return typed changes', () => {
            const typedChanges = changes.get<{ id: string; name: string }>(1);
            expect(typedChanges).toBeInstanceOf(SchemaPersistChanges);
        });
    });

    describe('aggregate properties', () => {
        beforeEach(() => {
            // Setup test data
            const changes1 = new SchemaPersistChanges();
            changes1.adds.push({ id: '1' } as any);
            changes1.adds.push({ id: '2' } as any);
            changes1.updates.push({ entity: { id: '3' }, changeType: 'propertiesChanged', delta: {} } as any);
            changes1.removes.push({ id: '4' } as any);

            const changes2 = new SchemaPersistChanges();
            changes2.adds.push({ id: '5' } as any);
            changes2.updates.push({ entity: { id: '6' }, changeType: 'propertiesChanged', delta: {} } as any);

            changes.set(1, changes1);
            changes.set(2, changes2);
        });

        it('should calculate aggregate size correctly', () => {
            expect(changes.aggregate.size).toBe(6); // 2+1+1+1+0+1
        });

        it('should calculate aggregate adds correctly', () => {
            expect(changes.aggregate.adds).toBe(3); // 2+1
        });

        it('should calculate aggregate updates correctly', () => {
            expect(changes.aggregate.updates).toBe(2); // 1+1
        });

        it('should calculate aggregate removes correctly', () => {
            expect(changes.aggregate.removes).toBe(1); // 1+0
        });
    });

    describe('toResult', () => {
        it('should create result with same schema IDs', () => {
            changes.set(1, new SchemaPersistChanges());
            changes.set(2, new SchemaPersistChanges());

            const result = changes.toResult();

            expect(result.has(1)).toBe(true);
            expect(result.has(2)).toBe(true);
            expect(result.size).toBe(2);
        });

        it('should create empty SchemaPersistResult instances', () => {
            changes.set(1, new SchemaPersistChanges());
            const result = changes.toResult();

            const schemaResult = result.get(1);
            expect(schemaResult).toBeInstanceOf(SchemaPersistResult);
            expect(schemaResult.adds).toEqual([]);
            expect(schemaResult.updates).toEqual([]);
            expect(schemaResult.removes).toEqual([]);
        });

        it('should handle empty changes map', () => {
            const result = changes.toResult();
            expect(result.size).toBe(0);
        });
    });

    describe('aggregate with empty changes', () => {
        it('should return 0 for all aggregates when empty', () => {
            expect(changes.aggregate.size).toBe(0);
            expect(changes.aggregate.adds).toBe(0);
            expect(changes.aggregate.updates).toBe(0);
            expect(changes.aggregate.removes).toBe(0);
        });
    });
});

describe('Edge cases and error scenarios', () => {
    it('should handle very large numbers correctly', () => {
        const changes = new SchemaPersistChanges();
        for (let i = 0; i < 10000; i++) {
            changes.adds.push({ id: i.toString() } as any);
        }
        expect(changes.total).toBe(10000);
        expect(changes.hasItems).toBe(true);
    });

    it('should handle mixed data types in arrays', () => {
        const changes = new SchemaPersistChanges();
        changes.adds.push({ id: '1', name: 'Test' } as any);
        changes.adds.push({ id: 2, count: 42 } as any);
        changes.adds.push({ id: '3', active: true } as any);

        expect(changes.total).toBe(3);
        expect(changes.hasItems).toBe(true);
    });

    it('should handle concurrent modifications', () => {
        const bulkChanges = new BulkPersistChanges();
        const changes1 = bulkChanges.resolve(1);
        const changes2 = bulkChanges.resolve(2);

        changes1.adds.push({ id: '1' } as any);
        changes2.adds.push({ id: '2' } as any);

        expect(bulkChanges.aggregate.adds).toBe(2);
        expect(bulkChanges.aggregate.size).toBe(2);
    });
});
