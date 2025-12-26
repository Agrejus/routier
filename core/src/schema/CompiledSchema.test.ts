import { describe, it, expect } from '@jest/globals';
import { CompiledSchema, HashType } from './types';
import { factories } from './testSchemas.test';
import { UnknownRecord } from '../utilities';
import { generateEntities, createPartialEntity } from '../utilities/dataGeneration';

/**
 * Comprehensive test suite for CompiledSchema functions.
 * Tests all functions across various schema types to ensure correct code generation and runtime behavior.
 */
describe('CompiledSchema Functions', () => {

    // Test each schema factory
    factories.forEach((factory, index) => {
        const schema = factory();
        const schemaName = schema.collectionName;

        describe(`${schemaName} (factory ${index})`, () => {

            describe('getId', () => {
                it('should return the ID of an entity', () => {
                    const [entity] = generateEntities(schema, { generateIdentityProperties: true });
                    const id = schema.getId(entity);
                    expect(id).toBeDefined();
                    expect(typeof id === 'string' || typeof id === 'number').toBe(true);
                });

                it('should return consistent IDs for the same entity', () => {
                    const [entity] = generateEntities(schema);
                    const id1 = schema.getId(entity);
                    const id2 = schema.getId(entity);
                    expect(id1).toBe(id2);
                });
            });

            describe('getIds', () => {
                it('should return an array of IDs', () => {
                    const [entity] = generateEntities(schema);
                    const ids = schema.getIds(entity);
                    expect(Array.isArray(ids)).toBe(true);
                    expect(ids.length).toBeGreaterThan(0);
                });
            });

            describe('getProperty', () => {
                it('should return property info for valid property IDs', () => {
                    if (schema.properties.length > 0) {
                        const firstProperty = schema.properties[0];
                        const property = schema.getProperty(firstProperty.id);
                        expect(property).toBeDefined();
                        expect(property?.name).toBe(firstProperty.name);
                    }
                });

                it('should return undefined for invalid property IDs', () => {
                    const property = schema.getProperty('nonexistent.property.id');
                    expect(property).toBeUndefined();
                });
            });

            describe('clone', () => {
                it('should create a deep clone of an entity', () => {
                    const [entity] = generateEntities(schema);
                    const cloned = schema.clone(entity);

                    expect(cloned).not.toBe(entity);
                    expect(cloned).toEqual(entity);
                });

                it('should not mutate the original entity', () => {
                    const [entity] = generateEntities(schema);
                    const cloned = schema.clone(entity);

                    // Modify cloned entity
                    if (typeof cloned === 'object' && cloned !== null) {
                        Object.keys(cloned).forEach(key => {
                            if (key !== 'id' && typeof cloned[key] === 'string') {
                                cloned[key] = 'modified';
                            }
                        });
                    }

                    // Original should be unchanged
                    expect(entity).not.toEqual(cloned);
                });

                it('should handle null and undefined', () => {
                    expect(() => schema.clone(null as any)).not.toThrow();
                    expect(() => schema.clone(undefined as any)).not.toThrow();
                });
            });

            describe('prepare', () => {
                it('should prepare an entity for creation', () => {
                    const [entity] = generateEntities(schema);
                    const prepared = schema.prepare(entity);
                    expect(prepared).toBeDefined();
                });

                it('should apply default values', () => {
                    const [entity] = generateEntities(schema);
                    const prepared = schema.prepare(entity);

                    // Check that defaults are applied (if schema has defaults)
                    schema.properties.forEach(prop => {
                        if (prop.defaultValue != null && typeof prop.defaultValue !== 'function') {
                            const value = (prepared as UnknownRecord)[prop.name];
                            if (value === null || value === undefined) {
                                // Default should be applied
                                expect(value).not.toBeNull();
                            }
                        }
                    });
                });

                it('should handle partial entities', () => {
                    const [fullEntity] = generateEntities(schema);
                    const partial = createPartialEntity(fullEntity, schema);
                    const prepared = schema.prepare(partial);
                    expect(prepared).toBeDefined();
                });
            });

            describe('merge', () => {
                it('should merge source into destination', () => {
                    const [destination] = generateEntities(schema);
                    const [source] = generateEntities(schema);

                    const merged = schema.merge(destination, source);
                    expect(merged).toBe(destination); // Should mutate destination
                });

                it('should overwrite destination values with source values', () => {
                    const [destination] = generateEntities(schema);
                    const [source] = generateEntities(schema);

                    // Modify source
                    const sourceRecord = source as Record<string, unknown>;
                    if (typeof source === 'object' && source !== null) {
                        Object.keys(sourceRecord).forEach(key => {
                            if (key !== 'id' && typeof sourceRecord[key] === 'string') {
                                sourceRecord[key] = 'merged-value';
                            }
                        });
                    }

                    const merged = schema.merge(destination, source);

                    // Check merged values
                    const mergedRecord = merged as Record<string, unknown>;
                    if (typeof merged === 'object' && merged !== null) {
                        Object.keys(sourceRecord).forEach(key => {
                            if (key !== 'id') {
                                const sourceValue = sourceRecord[key];
                                const mergedValue = mergedRecord[key];
                                if (Array.isArray(sourceValue)) {
                                    expect(mergedValue).toStrictEqual(sourceValue);
                                } else if (typeof sourceValue === 'object' && sourceValue !== null && !(sourceValue instanceof Date)) {
                                    expect(mergedValue).toStrictEqual(sourceValue);
                                } else if (sourceValue instanceof Date) {
                                    expect(mergedValue).toStrictEqual(sourceValue);
                                } else {
                                    expect(mergedValue).toBe(sourceValue);
                                }
                            }
                        });
                    }
                });

                it('should handle null source values', () => {
                    const [destination] = generateEntities(schema);
                    const [sourceEntity] = generateEntities<UnknownRecord>(schema);
                    const source: UnknownRecord = { ...sourceEntity };

                    // Set some values to null
                    Object.keys(source).forEach(key => {
                        if (key !== 'id') {
                            source[key] = null;
                        }
                    });

                    expect(() => schema.merge(destination, source as typeof destination)).not.toThrow();
                });
            });

            describe('strip', () => {
                it('should remove unmapped properties', () => {
                    const [entity] = generateEntities(schema);
                    (entity as any).unmappedProperty = 'should be removed';

                    const stripped = schema.strip(entity);
                    expect((stripped as any).unmappedProperty).toBeUndefined();
                });

                it('should preserve mapped properties', () => {
                    const [entity] = generateEntities(schema);
                    const stripped = schema.strip(entity);
                    const entityRecord = entity as Record<string, unknown>;

                    schema.properties.forEach(prop => {
                        if (!prop.isUnmapped) {
                            // Only check properties that exist in the original entity
                            if (prop.name in entityRecord) {
                                const value = stripped[prop.name];
                                expect(value).toBeDefined();
                            }
                        }
                    });
                });
            });

            describe('serialize', () => {
                it('should serialize an entity', () => {
                    const [entity] = generateEntities(schema);
                    const serialized = schema.serialize(entity);
                    expect(serialized).toBeDefined();
                });

                it('should handle dates correctly', () => {
                    const [entity] = generateEntities(schema);
                    const serialized = schema.serialize(entity);

                    schema.properties.forEach(prop => {
                        if (prop.type === 'Date') {
                            const value = serialized[prop.name];
                            if (value != null) {
                                // Should be serialized (string or ISO string)
                                expect(typeof value === 'string' || value instanceof Date).toBe(true);
                            }
                        }
                    });
                });
            });

            describe('deserialize', () => {
                it('should deserialize an entity', () => {
                    const [entity] = generateEntities(schema);
                    const serialized = schema.serialize(entity);
                    const deserialized = schema.deserialize(serialized);

                    expect(deserialized).toBeDefined();
                });

                it('should round-trip serialize/deserialize', () => {
                    const [entity] = generateEntities(schema);
                    const serialized = schema.serialize(entity);
                    const deserialized = schema.deserialize(serialized);

                    // IDs should match
                    expect(schema.getId(deserialized)).toBe(schema.getId(entity));
                });
            });

            describe('preprocess', () => {
                it('should preprocess an entity (prepare + serialize)', () => {
                    const [entity] = generateEntities(schema);
                    const preprocessed = (schema.preprocess)(entity);
                    expect(preprocessed).toBeDefined();
                });
            });

            describe('postprocess', () => {
                it('should postprocess an entity (deserialize + enrich)', () => {
                    const [entity] = generateEntities(schema);
                    const serialized = schema.serialize(entity);
                    const postprocessed = (schema.postprocess)(serialized, 'proxy');
                    expect(postprocessed).toBeDefined();
                });
            });

            describe('compare', () => {
                it('should return true for identical entities', () => {
                    const [entity] = generateEntities(schema);
                    const result = schema.compare(entity, entity);
                    expect(result).toBe(true);
                });

                it('should return false for different entities', () => {
                    const [entity1] = generateEntities(schema);
                    const [entity2] = generateEntities(schema);

                    // Ensure different IDs
                    const entity1Record = entity1 as Record<string, unknown>;
                    const entity2Record = entity2 as Record<string, unknown>;
                    if (entity1Record.id !== entity2Record.id) {
                        const result = schema.compare(entity1, entity2);
                        expect(result).toBe(false);
                    }
                });
            });

            describe('compareIds', () => {
                it('should return true for entities with same IDs', () => {
                    const [entity] = generateEntities(schema);
                    const result = schema.compareIds(entity, entity);
                    expect(result).toBe(true);
                });

                it('should return false for entities with different IDs', () => {
                    const [entity1] = generateEntities(schema);
                    const [entity2] = generateEntities(schema);

                    const entity1Record = entity1 as Record<string, unknown>;
                    const entity2Record = entity2 as Record<string, unknown>;
                    if (entity1Record.id !== entity2Record.id) {
                        const result = schema.compareIds(entity1, entity2);
                        expect(result).toBe(false);
                    }
                });
            });

            describe('hash', () => {
                it('should generate a hash for an entity', () => {
                    const [entity] = generateEntities(schema);
                    const hash = schema.hash(entity, HashType.Ids);
                    expect(hash).toBeDefined();
                    expect(typeof hash === 'string').toBe(true);
                });

                it('should generate consistent hashes for the same entity', () => {
                    const [entity] = generateEntities(schema);
                    const hash1 = schema.hash(entity, HashType.Ids);
                    const hash2 = schema.hash(entity, HashType.Ids);
                    expect(hash1).toBe(hash2);
                });

                it('should generate different hashes for different entities', () => {
                    const [entity1] = generateEntities(schema);
                    const [entity2] = generateEntities(schema);

                    const entity1Record = entity1 as Record<string, unknown>;
                    const entity2Record = entity2 as Record<string, unknown>;
                    if (entity1Record.id !== entity2Record.id) {
                        const hash1 = schema.hash(entity1, HashType.Ids);
                        const hash2 = schema.hash(entity2, HashType.Ids);
                        expect(hash1).not.toBe(hash2);
                    }
                });

                it('should support Object hash type', () => {
                    const [entity] = generateEntities(schema);
                    const hash = schema.hash(entity, HashType.Object);
                    expect(hash).toBeDefined();
                });
            });

            describe('getHashType', () => {
                it('should return a hash type', () => {
                    const [entity] = generateEntities(schema);
                    const hashType = schema.getHashType(entity);
                    expect(['Ids', 'Object']).toContain(hashType);
                });
            });

            describe('enrich', () => {
                it('should enrich an entity with proxy tracking', () => {
                    const [entity] = generateEntities(schema);
                    const enriched = schema.enrich(entity, 'proxy');
                    expect(enriched).toBeDefined();
                });

                it('should enrich an entity with immutable tracking', () => {
                    const [entity] = generateEntities(schema);
                    const enriched = schema.enrich(entity, 'immutable');
                    expect(enriched).toBeDefined();
                });

                it('should enrich an entity with no tracking', () => {
                    const [entity] = generateEntities(schema);
                    const enriched = schema.enrich(entity, 'diff');
                    expect(enriched).toBeDefined();
                });
            });

            describe('freeze', () => {
                it('should freeze an entity', () => {
                    const [entity] = generateEntities(schema);
                    const frozen = schema.freeze(entity);
                    expect(Object.isFrozen(frozen)).toBe(true);
                });
            });

            describe('enableChangeTracking', () => {
                it('should enable change tracking on an entity', () => {
                    const [entity] = generateEntities(schema);
                    const tracked = schema.enableChangeTracking(entity);
                    expect(tracked).toBeDefined();
                });
            });

            describe('deserializePartial', () => {
                it('should deserialize partial entity data', () => {
                    const [entity] = generateEntities<UnknownRecord>(schema);
                    const partial: UnknownRecord = {};
                    const entityRecord = entity;
                    schema.properties.slice(0, 2).forEach(prop => {
                        if (prop.name in entityRecord) {
                            partial[prop.name] = entityRecord[prop.name];
                        }
                    });

                    const deserialized = schema.deserializePartial(partial, schema.properties.slice(0, 2));
                    expect(deserialized).toBeDefined();
                });
            });

            describe('metadata', () => {
                it('should have correct collection name', () => {
                    expect(schema.collectionName).toBe(schemaName);
                });

                it('should have properties array', () => {
                    expect(Array.isArray(schema.properties)).toBe(true);
                });

                it('should have idProperties array', () => {
                    expect(Array.isArray(schema.idProperties)).toBe(true);
                    expect(schema.idProperties.length).toBeGreaterThan(0);
                });

                it('should have hasIdentities boolean', () => {
                    expect(typeof schema.hasIdentities).toBe('boolean');
                });

                it('should have hasIdentityKeys boolean', () => {
                    expect(typeof schema.hasIdentityKeys).toBe('boolean');
                });

                it('should have hashType', () => {
                    expect(['Ids', 'Object']).toContain(schema.hashType);
                });

                it('should have unique schema id', () => {
                    expect(schema.id).toBeDefined();
                    expect(typeof schema.id === 'number').toBe(true);
                });

                it('should have getIndexes function', () => {
                    expect(typeof schema.getIndexes).toBe('function');
                    const indexes = schema.getIndexes();
                    expect(Array.isArray(indexes)).toBe(true);
                });
            });
        });
    });

    // Edge case tests
    describe('Edge Cases', () => {
        const simpleSchema = factories[0]();

        describe('null and undefined handling', () => {
            it('should handle null entities gracefully', () => {
                expect(() => simpleSchema.getId(null as any)).not.toThrow();
                expect(() => simpleSchema.clone(null as any)).not.toThrow();
                expect(() => simpleSchema.serialize(null as any)).not.toThrow();
            });

            it('should handle undefined entities gracefully', () => {
                expect(() => simpleSchema.getId(undefined as any)).not.toThrow();
                expect(() => simpleSchema.clone(undefined as any)).not.toThrow();
            });
        });

        describe('empty objects', () => {
            it('should handle empty entity objects', () => {
                const empty = {} as any;
                expect(() => simpleSchema.prepare(empty)).not.toThrow();
                expect(() => simpleSchema.merge(empty, {} as any)).not.toThrow();
            });
        });

        describe('arrays', () => {
            it('should handle array properties correctly', () => {
                const arraySchema = factories.find(f => {
                    const s = f();
                    return s.properties.some(p => p.type === 'Array');
                });

                if (arraySchema) {
                    const schema = arraySchema();
                    const [entity] = generateEntities(schema);
                    expect(() => schema.serialize(entity)).not.toThrow();
                    expect(() => schema.clone(entity)).not.toThrow();
                }
            });
        });

        describe('nested objects', () => {
            it('should handle deeply nested objects', () => {
                const nestedSchema = factories.find(f => {
                    const s = f();
                    return s.properties.some(p => p.type === 'Object' && p.children.length > 0);
                });

                if (nestedSchema) {
                    const schema = nestedSchema();
                    const [entity] = generateEntities(schema);
                    expect(() => schema.serialize(entity)).not.toThrow();
                    expect(() => schema.clone(entity)).not.toThrow();
                    expect(() => schema.merge(entity, entity)).not.toThrow();
                }
            });
        });
    });
});