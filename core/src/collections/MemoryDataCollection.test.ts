import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryDataCollection } from './MemoryDataCollection';
import { CompiledSchema, SchemaTypes } from '../schema';
import { PropertyInfo } from '../schema/PropertyInfo';
import { Result } from '../results';

vi.mock('../utilities/uuid', () => ({
    uuidv4: vi.fn(() => 'mock-uuid-123')
}));

describe('EphemeralDataCollection', () => {
    let mockSchema: CompiledSchema<any>;
    let mockIdProperty: PropertyInfo<any>;
    let collection: MemoryDataCollection;

    beforeEach(() => {
        mockIdProperty = {
            id: 'id',
            name: 'id',
            type: SchemaTypes.String,
            getValue: vi.fn((item: any) => item.id),
            setValue: vi.fn(),
            isIdentity: true,
            isKey: true,
            isNullable: false,
            isOptional: false,
            isReadonly: false,
            isUnmapped: false,
            isDistinct: false,
            indexes: [],
            injected: null,
            defaultValue: null,
            valueSerializer: null,
            valueDeserializer: null,
            functionBody: null,
            children: [],
            schema: {} as any,
            literals: [],
            parent: undefined,
            level: 0,
            _getPropertyChain: vi.fn(),
            _needsOptionalChaining: vi.fn(),
            _resolvePathArray: vi.fn(),
            getPathArray: vi.fn(() => ['id']),
            getParentPathArray: vi.fn(),
            hasNullableParents: false,
            hasIdentityChildren: false,
            getSelectrorPath: vi.fn(),
            getAssignmentPath: vi.fn()
        } as any;

        mockSchema = {
            idProperties: [mockIdProperty],
            hasIdentityKeys: true,
            properties: [mockIdProperty],
            hasIdentities: true,
            hashType: 'Ids' as any,
            hash: vi.fn(),
            getHashType: vi.fn(),
            compare: vi.fn(),
            deserialize: vi.fn(),
            serialize: vi.fn(),
            id: 1,
            collectionName: 'test_collection',
            getIds: vi.fn(),
            enrich: vi.fn(),
            freeze: vi.fn(),
            enableChangeTracking: vi.fn(),
            definition: {} as any,
            getIndexes: vi.fn(() => []),
            createSubscription: vi.fn(),
            getProperty: vi.fn(),
            getId: vi.fn(),
            clone: vi.fn(),
            strip: vi.fn(),
            prepare: vi.fn(),
            merge: vi.fn()
        } as any;

        collection = new MemoryDataCollection(mockSchema);
    });

    describe('constructor', () => {
        it('should initialize with empty data and numerical ids', () => {
            const newCollection = new MemoryDataCollection(mockSchema);

            expect(newCollection.size).toBe(0);
            expect(newCollection.records).toEqual([]);
        });

        it('should store the schema and id properties', () => {
            expect(collection['schema']).toBe(mockSchema);
            expect(collection['idProperties']).toEqual([mockIdProperty]);
        });
    });

    describe('size', () => {
        it('should return zero for empty collection', () => {
            expect(collection.size).toBe(0);
        });

        it('should return correct size after adding items', () => {
            const item1 = { id: '1', name: 'test1' };
            const item2 = { id: '2', name: 'test2' };

            collection.add(item1);
            collection.add(item2);

            expect(collection.size).toBe(2);
        });
    });

    describe('records', () => {
        it('should return empty array for empty collection', () => {
            expect(collection.records).toEqual([]);
        });

        it('should return all records in collection', () => {
            const item1 = { id: '1', name: 'test1' };
            const item2 = { id: '2', name: 'test2' };

            collection.add(item1);
            collection.add(item2);

            const records = collection.records;
            expect(records).toHaveLength(2);
            expect(records).toContainEqual(item1);
            expect(records).toContainEqual(item2);
        });
    });

    describe('seed', () => {
        it('should add multiple items to collection', () => {
            const items = [
                { id: '1', name: 'test1' },
                { id: '2', name: 'test2' },
                { id: '3', name: 'test3' }
            ];

            collection.seed(items);

            expect(collection.size).toBe(3);
            expect(collection.records).toHaveLength(3);
        });

        it('should handle empty array', () => {
            collection.seed([]);

            expect(collection.size).toBe(0);
            expect(collection.records).toEqual([]);
        });

        it('should generate ids for items without ids', () => {
            const items = [
                { id: '1', name: 'test1' },
                { id: '2', name: 'test2' }
            ];

            collection.seed(items);

            expect(collection.size).toBe(2);
        });
    });

    describe('add', () => {
        it('should add item with existing id', () => {
            const item = { id: 'test-id', name: 'test' };

            collection.add(item);

            expect(collection.size).toBe(1);
            expect(collection.records).toContainEqual(item);
        });

        it('should generate string id for item without id', () => {
            const item = { name: 'test' } as any;

            collection.add(item);

            expect(collection.size).toBe(1);
            expect(item.id).toBe('mock-uuid-123');
        });

        it('should generate numerical id for numerical id property', () => {
            const numericalIdProperty = {
                ...mockIdProperty,
                type: SchemaTypes.Number
            } as any;
            const numericalSchema = {
                ...mockSchema,
                idProperties: [numericalIdProperty]
            } as any;
            const numericalCollection = new MemoryDataCollection(numericalSchema);
            const item = { name: 'test' } as any;

            numericalCollection.add(item);

            expect(numericalCollection.size).toBe(1);
            expect(item.id).toBe(1);
        });

        it('should throw error for unsupported id type', () => {
            const unsupportedIdProperty = {
                ...mockIdProperty,
                type: SchemaTypes.Boolean
            } as any;
            const unsupportedSchema = {
                ...mockSchema,
                idProperties: [unsupportedIdProperty]
            } as any;
            const unsupportedCollection = new MemoryDataCollection(unsupportedSchema);
            const item = { name: 'test' } as any;

            expect(() => unsupportedCollection.add(item)).toThrow(
                "Id Property 'id' must be string or number, found 'Boolean'"
            );
        });

        it('should handle multiple id properties', () => {
            const idProperty1 = { ...mockIdProperty, name: 'id1', id: 'id1' } as any;
            const idProperty2 = { ...mockIdProperty, name: 'id2', id: 'id2' } as any;
            const multiIdSchema = {
                ...mockSchema,
                idProperties: [idProperty1, idProperty2]
            } as any;
            const multiIdCollection = new MemoryDataCollection(multiIdSchema);
            const item = { name: 'test' } as any;

            multiIdCollection.add(item);

            expect(multiIdCollection.size).toBe(1);
            expect(item.id1).toBe('mock-uuid-123');
            expect(item.id2).toBe('mock-uuid-123');
        });
    });

    describe('remove', () => {
        it('should remove existing item', () => {
            const item = { id: 'test-id', name: 'test' };
            collection.add(item);

            collection.remove(item);

            expect(collection.size).toBe(0);
            expect(collection.records).toEqual([]);
        });

        it('should handle removing non-existent item', () => {
            const item = { id: 'non-existent', name: 'test' };

            expect(() => collection.remove(item)).not.toThrow();
            expect(collection.size).toBe(0);
        });

        it('should throw error when key is null', () => {
            const item = { id: null, name: 'test' } as any;

            expect(() => collection.remove(item)).toThrow('Key cannot be null.  Key: id');
        });

        it('should handle multiple id properties for removal', () => {
            const idProperty1 = {
                ...mockIdProperty,
                name: 'id1',
                id: 'id1',
                getValue: vi.fn((item: any) => item.id1)
            } as any;
            const idProperty2 = {
                ...mockIdProperty,
                name: 'id2',
                id: 'id2',
                getValue: vi.fn((item: any) => item.id2)
            } as any;
            const multiIdSchema = {
                ...mockSchema,
                idProperties: [idProperty1, idProperty2],
                hasIdentityKeys: false
            } as any;
            const multiIdCollection = new MemoryDataCollection(multiIdSchema);
            const item = { id1: '1', id2: '2', name: 'test' };

            multiIdCollection.add(item);
            multiIdCollection.remove(item);

            expect(multiIdCollection.size).toBe(0);
        });
    });

    describe('update', () => {
        it('should update existing item', () => {
            const item = { id: 'test-id', name: 'test' };
            collection.add(item);

            item.name = 'updated';
            collection.update(item);

            expect(collection.size).toBe(1);
            expect(collection.records[0].name).toBe('updated');
        });

        it('should add item if it does not exist', () => {
            const item = { id: 'new-id', name: 'new' };

            collection.update(item);

            expect(collection.size).toBe(1);
            expect(collection.records).toContainEqual(item);
        });

        it('should throw error when key is null', () => {
            const item = { id: null, name: 'test' } as any;

            expect(() => collection.update(item)).toThrow('Key cannot be null.  Key: id');
        });
    });

    describe('destroy', () => {
        it('should clear all data and numerical ids', () => {
            const item1 = { id: '1', name: 'test1' };
            const item2 = { id: '2', name: 'test2' };

            collection.add(item1);
            collection.add(item2);

            const mockCallback = vi.fn();
            collection.destroy(mockCallback);

            expect(collection.size).toBe(0);
            expect(collection.records).toEqual([]);
            expect(mockCallback).toHaveBeenCalledWith(Result.success());
        });

        it('should handle destroy on empty collection', () => {
            const mockCallback = vi.fn();
            collection.destroy(mockCallback);

            expect(collection.size).toBe(0);
            expect(mockCallback).toHaveBeenCalledWith(Result.success());
        });
    });

    describe('id generation', () => {
        it('should increment numerical ids correctly', () => {
            const numericalIdProperty = {
                ...mockIdProperty,
                type: SchemaTypes.Number
            } as any;
            const numericalSchema = {
                ...mockSchema,
                idProperties: [numericalIdProperty]
            } as any;
            const numericalCollection = new MemoryDataCollection(numericalSchema);

            const item1 = { name: 'test1' } as any;
            const item2 = { name: 'test2' } as any;
            const item3 = { name: 'test3' } as any;

            numericalCollection.add(item1);
            numericalCollection.add(item2);
            numericalCollection.add(item3);

            expect(item1.id).toBe(1);
            expect(item2.id).toBe(2);
            expect(item3.id).toBe(3);
        });

        it('should handle numerical ids with existing values', () => {
            const numericalIdProperty = {
                ...mockIdProperty,
                type: SchemaTypes.Number
            } as any;
            const numericalSchema = {
                ...mockSchema,
                idProperties: [numericalIdProperty]
            } as any;
            const numericalCollection = new MemoryDataCollection(numericalSchema);

            const item1 = { id: 5, name: 'test1' };
            const item2 = { name: 'test2' } as any;

            numericalCollection.add(item1);
            numericalCollection.add(item2);

            expect(item1.id).toBe(5);
            expect(item2.id).toBe(1);
        });
    });

    describe('edge cases', () => {
        it('should handle schema without identity keys', () => {
            const nonIdentitySchema = {
                ...mockSchema,
                hasIdentityKeys: false
            } as any;
            const nonIdentityCollection = new MemoryDataCollection(nonIdentitySchema);
            const item = { id: 'existing-id', name: 'test' };

            nonIdentityCollection.add(item);

            expect(nonIdentityCollection.size).toBe(1);
            expect(nonIdentityCollection.records).toContainEqual(item);
        });

        it('should handle items with undefined id properties', () => {
            const item = { name: 'test' } as any;

            collection.add(item);

            expect(collection.size).toBe(1);
            expect(item.id).toBeDefined();
        });

        it('should handle multiple items with same id', () => {
            const item1 = { id: 'same-id', name: 'test1' };
            const item2 = { id: 'same-id', name: 'test2' };

            collection.add(item1);
            collection.add(item2);

            expect(collection.size).toBe(1);
            expect(collection.records).toContainEqual(item2);
        });
    });
});
