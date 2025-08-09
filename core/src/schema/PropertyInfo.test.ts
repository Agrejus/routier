import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyInfo } from './PropertyInfo';
import { SchemaBase } from './property/base/SchemaBase';
import { SchemaTypes } from './types';

class MockSchema extends SchemaBase<any, any> {
    instance = {};
    type = SchemaTypes.String;
    isNullable = false;
    isOptional = false;
    isKey = false;
    isIdentity = false;
    isReadonly = false;
    isUnmapped = false;
    isDistict = false;
    indexes: string[] = [];
    injected: any = null;
    defaultValue: any = null;
    valueSerializer: any = null;
    valueDeserializer: any = null;
    functionBody: any = null;
    literals: any[] = [];
}

class MockNullableSchema extends SchemaBase<any, any> {
    instance = {};
    type = SchemaTypes.String;
    isNullable = true;
    isOptional = false;
    isKey = false;
    isIdentity = false;
    isReadonly = false;
    isUnmapped = false;
    isDistict = false;
    indexes: string[] = [];
    injected: any = null;
    defaultValue: any = null;
    valueSerializer: any = null;
    valueDeserializer: any = null;
    functionBody: any = null;
    literals: any[] = [];
}

class MockOptionalSchema extends SchemaBase<any, any> {
    instance = {};
    type = SchemaTypes.String;
    isNullable = false;
    isOptional = true;
    isKey = false;
    isIdentity = false;
    isReadonly = false;
    isUnmapped = false;
    isDistict = false;
    indexes: string[] = [];
    injected: any = null;
    defaultValue: any = null;
    valueSerializer: any = null;
    valueDeserializer: any = null;
    functionBody: any = null;
    literals: any[] = [];
}

describe('PropertyInfo', () => {
    let mockSchema: MockSchema;
    let nullableSchema: MockNullableSchema;
    let optionalSchema: MockOptionalSchema;

    beforeEach(() => {
        mockSchema = new MockSchema();
        nullableSchema = new MockNullableSchema();
        optionalSchema = new MockOptionalSchema();
    });

    describe('constructor and basic properties', () => {
        it('should create PropertyInfo with correct basic properties', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.name).toBe('testProperty');
            expect(propertyInfo.type).toBe(SchemaTypes.String);
            expect(propertyInfo.isNullable).toBe(false);
            expect(propertyInfo.isOptional).toBe(false);
            expect(propertyInfo.isKey).toBe(false);
            expect(propertyInfo.isIdentity).toBe(false);
            expect(propertyInfo.isReadonly).toBe(false);
            expect(propertyInfo.isUnmapped).toBe(false);
            expect(propertyInfo.isDistinct).toBe(false);
            expect(propertyInfo.indexes).toEqual([]);
            expect(propertyInfo.injected).toBeNull();
            expect(propertyInfo.defaultValue).toBeNull();
            expect(propertyInfo.valueSerializer).toBeNull();
            expect(propertyInfo.valueDeserializer).toBeNull();
            expect(propertyInfo.functionBody).toBeNull();
            expect(propertyInfo.children).toEqual([]);
            expect(propertyInfo.schema).toBe(mockSchema);
            expect(propertyInfo.parent).toBeUndefined();
            expect(propertyInfo.literals).toEqual([]);
        });

        it('should create PropertyInfo with nullable schema', () => {
            const propertyInfo = new PropertyInfo(nullableSchema, 'nullableProperty');

            expect(propertyInfo.isNullable).toBe(true);
            expect(propertyInfo.isOptional).toBe(false);
        });

        it('should create PropertyInfo with optional schema', () => {
            const propertyInfo = new PropertyInfo(optionalSchema, 'optionalProperty');

            expect(propertyInfo.isNullable).toBe(false);
            expect(propertyInfo.isOptional).toBe(true);
        });

        it('should create PropertyInfo with parent', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.parent).toBe(parentPropertyInfo);
            expect(childPropertyInfo.name).toBe('childProperty');
        });
    });

    describe('id property', () => {
        it('should return property name for root property', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.id).toBe('testProperty');
        });

        it('should return dot-separated path for nested property', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.id).toBe('parentProperty.childProperty');
        });

        it('should return full path for deeply nested property', () => {
            const grandparentPropertyInfo = new PropertyInfo(mockSchema, 'grandparentProperty');
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty', grandparentPropertyInfo);
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.id).toBe('grandparentProperty.parentProperty.childProperty');
        });
    });

    describe('level property', () => {
        it('should return 0 for root property', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.level).toBe(0);
        });

        it('should return 1 for first level child', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.level).toBe(1);
        });

        it('should return 2 for second level child', () => {
            const grandparentPropertyInfo = new PropertyInfo(mockSchema, 'grandparentProperty');
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty', grandparentPropertyInfo);
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.level).toBe(2);
        });
    });

    describe('getPathArray', () => {
        it('should return array with property name for root property', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.getPathArray()).toEqual(['testProperty']);
        });

        it('should return full path array for nested property', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getPathArray()).toEqual(['parentProperty', 'childProperty']);
        });

        it('should return full path array for deeply nested property', () => {
            const grandparentPropertyInfo = new PropertyInfo(mockSchema, 'grandparentProperty');
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty', grandparentPropertyInfo);
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getPathArray()).toEqual(['grandparentProperty', 'parentProperty', 'childProperty']);
        });
    });

    describe('getParentPathArray', () => {
        it('should return empty array for root property', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.getParentPathArray()).toEqual([]);
        });

        it('should return parent path array for nested property', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getParentPathArray()).toEqual(['parentProperty']);
        });

        it('should return full parent path array for deeply nested property', () => {
            const grandparentPropertyInfo = new PropertyInfo(mockSchema, 'grandparentProperty');
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty', grandparentPropertyInfo);
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getParentPathArray()).toEqual(['grandparentProperty', 'parentProperty']);
        });
    });

    describe('hasNullableParents', () => {
        it('should return false for root property with non-nullable schema', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.hasNullableParents).toBe(false);
        });

        it('should return true when parent is nullable', () => {
            const parentPropertyInfo = new PropertyInfo(nullableSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.hasNullableParents).toBe(true);
        });

        it('should return true when grandparent is nullable', () => {
            const grandparentPropertyInfo = new PropertyInfo(nullableSchema, 'grandparentProperty');
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty', grandparentPropertyInfo);
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.hasNullableParents).toBe(true);
        });

        it('should return false when no parents are nullable', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.hasNullableParents).toBe(false);
        });
    });

    describe('hasIdentityChildren', () => {
        it('should return false for property with no children', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.hasIdentityChildren).toBe(false);
        });

        it('should return true when direct child is identity', () => {
            const identitySchema = new MockSchema();
            identitySchema.isIdentity = true;

            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(identitySchema, 'childProperty', parentPropertyInfo);

            // Manually add child to parent's children array
            (parentPropertyInfo as any).children.push(childPropertyInfo);

            expect(parentPropertyInfo.hasIdentityChildren).toBe(true);
        });

        it('should return true when grandchild is identity', () => {
            const identitySchema = new MockSchema();
            identitySchema.isIdentity = true;

            const grandparentPropertyInfo = new PropertyInfo(mockSchema, 'grandparentProperty');
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty', grandparentPropertyInfo);
            const childPropertyInfo = new PropertyInfo(identitySchema, 'childProperty', parentPropertyInfo);

            // Manually add children to their respective parents
            (grandparentPropertyInfo as any).children.push(parentPropertyInfo);
            (parentPropertyInfo as any).children.push(childPropertyInfo);

            expect(grandparentPropertyInfo.hasIdentityChildren).toBe(true);
        });

        it('should return false when no children are identity', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(parentPropertyInfo.hasIdentityChildren).toBe(false);
        });
    });

    describe('getValue', () => {
        it('should return null for null instance', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.getValue(null)).toBeNull();
        });

        it('should return null for undefined instance', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.getValue(undefined)).toBeNull();
        });

        it('should return value for simple property', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');
            const instance = { testProperty: 'testValue' };

            expect(propertyInfo.getValue(instance)).toBe('testValue');
        });

        it('should return value for nested property', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);
            const instance: any = { parentProperty: { childProperty: 'nestedValue' } };

            expect(childPropertyInfo.getValue(instance)).toBe('nestedValue');
        });

        it('should return null when intermediate property is null', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);
            const instance: any = { parentProperty: null };

            expect(childPropertyInfo.getValue(instance)).toBeNull();
        });

        it('should return null when intermediate property is undefined', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);
            const instance: any = { parentProperty: undefined };

            expect(childPropertyInfo.getValue(instance)).toBeNull();
        });
    });

    describe('setValue', () => {
        it('should set value for simple property', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');
            const instance = {};

            propertyInfo.setValue(instance, 'newValue');

            expect(instance).toEqual({ testProperty: 'newValue' });
        });

        it('should set value for nested property', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);
            const instance = {};

            childPropertyInfo.setValue(instance, 'nestedValue');

            expect(instance).toEqual({ parentProperty: { childProperty: 'nestedValue' } });
        });

        it('should create intermediate objects when they do not exist', () => {
            const grandparentPropertyInfo = new PropertyInfo(mockSchema, 'grandparentProperty');
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty', grandparentPropertyInfo);
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);
            const instance = {};

            childPropertyInfo.setValue(instance, 'deepValue');

            expect(instance).toEqual({
                grandparentProperty: {
                    parentProperty: {
                        childProperty: 'deepValue'
                    }
                }
            });
        });

        it('should use existing intermediate objects', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);
            const instance = { parentProperty: { existingProperty: 'existingValue' } };

            childPropertyInfo.setValue(instance, 'newValue');

            expect(instance).toEqual({
                parentProperty: {
                    existingProperty: 'existingValue',
                    childProperty: 'newValue'
                }
            });
        });

        it('should throw error for null instance', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(() => propertyInfo.setValue(null, 'value')).toThrow('Cannot set value on null or undefined instance');
        });

        it('should throw error for undefined instance', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(() => propertyInfo.setValue(undefined, 'value')).toThrow('Cannot set value on null or undefined instance');
        });
    });

    describe('getSelectrorPath', () => {
        it('should return path with parent for root property', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.getSelectrorPath({ parent: 'entity' })).toBe('entity.testProperty');
        });

        it('should return path with parent for nested property', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getSelectrorPath({ parent: 'entity' })).toBe('entity.parentProperty.childProperty');
        });

        it('should return path with optional chaining for nullable property', () => {
            const propertyInfo = new PropertyInfo(nullableSchema, 'testProperty');

            expect(propertyInfo.getSelectrorPath({ parent: 'entity' })).toBe('entity?.testProperty');
        });

        it('should return path with optional chaining for optional property', () => {
            const propertyInfo = new PropertyInfo(optionalSchema, 'testProperty');

            expect(propertyInfo.getSelectrorPath({ parent: 'entity' })).toBe('entity?.testProperty');
        });

        it('should return path with optional chaining when parent is nullable', () => {
            const parentPropertyInfo = new PropertyInfo(nullableSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getSelectrorPath({ parent: 'entity' })).toBe('entity?.parentProperty.childProperty');
        });

        it('should return path without optional chaining for assignment type', () => {
            const propertyInfo = new PropertyInfo(nullableSchema, 'testProperty');

            expect(propertyInfo.getSelectrorPath({
                parent: 'entity',
                assignmentType: 'ASSIGNMENT'
            })).toBe('entity.testProperty');
        });
    });

    describe('getAssignmentPath', () => {
        it('should return property name for root property without parent', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.getAssignmentPath()).toBe('testProperty');
        });

        it('should return path for nested property without parent', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getAssignmentPath()).toBe('parentProperty.childProperty');
        });

        it('should return path with parent when provided', () => {
            const propertyInfo = new PropertyInfo(mockSchema, 'testProperty');

            expect(propertyInfo.getAssignmentPath({ parent: 'entity' })).toBe('entity.testProperty');
        });

        it('should return path with parent for nested property', () => {
            const parentPropertyInfo = new PropertyInfo(mockSchema, 'parentProperty');
            const childPropertyInfo = new PropertyInfo(mockSchema, 'childProperty', parentPropertyInfo);

            expect(childPropertyInfo.getAssignmentPath({ parent: 'entity' })).toBe('entity.parentProperty.childProperty');
        });

        it('should return path without optional chaining for nullable property', () => {
            const propertyInfo = new PropertyInfo(nullableSchema, 'testProperty');

            expect(propertyInfo.getAssignmentPath()).toBe('testProperty');
        });

        it('should return path without optional chaining for optional property', () => {
            const propertyInfo = new PropertyInfo(optionalSchema, 'testProperty');

            expect(propertyInfo.getAssignmentPath()).toBe('testProperty');
        });
    });
}); 