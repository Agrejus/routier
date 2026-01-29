import { describe, it, expect } from '@jest/globals';
import { s } from '../builder';
import { SchemaDefinition } from '../SchemaDefinition';
import {
    compiledSchemaToJsonSchema,
    rehydrateSchemaFromJsonSchema,
    rehydrateSchemaFromJsonString,
    createStandardJsonSchemaProps
} from './standardJsonSchema';

describe('Standard JSON Schema', () => {
    describe('compiledSchemaToJsonSchema', () => {
        it('should convert a simple schema to JSON Schema', () => {
            const schema = s.define('users', {
                id: s.string().key().identity(),
                name: s.string(),
                age: s.number()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);

            expect(jsonSchema.type).toBe('object');
            expect(jsonSchema.properties).toBeDefined();
            expect((jsonSchema.properties as Record<string, unknown>).id).toBeDefined();
            expect((jsonSchema.properties as Record<string, unknown>).name).toBeDefined();
            expect((jsonSchema.properties as Record<string, unknown>).age).toBeDefined();
            expect(jsonSchema.required).toContain('id');
            expect(jsonSchema.required).toContain('name');
            expect(jsonSchema.required).toContain('age');
        });

        it('should include Routier metadata', () => {
            const schema = s.define('users', {
                id: s.string().key().identity(),
                name: s.string().distinct(),
                email: s.string().readonly()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
            const routierMeta = jsonSchema['x-routier'] as Record<string, unknown>;

            expect(routierMeta).toBeDefined();
            expect(routierMeta.collectionName).toBe('users');
            expect(routierMeta.idProperties).toEqual(['id']);
            expect(routierMeta.hasIdentities).toBe(true);
            expect(routierMeta.hasIdentityKeys).toBe(true);
        });

        it('should handle nullable properties', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                name: s.string().nullable(),
                email: s.string().optional()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
            const nameProp = (jsonSchema.properties as Record<string, unknown>).name as Record<string, unknown>;

            expect(Array.isArray(nameProp.type) && nameProp.type.includes('null')).toBe(true);
            expect(jsonSchema.required).not.toContain('email');
        });

        it('should handle nested objects', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                address: s.object({
                    street: s.string(),
                    city: s.string(),
                    zip: s.string()
                })
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
            const addressProp = (jsonSchema.properties as Record<string, unknown>).address as Record<string, unknown>;

            expect(addressProp.type).toBe('object');
            expect(addressProp.properties).toBeDefined();
            expect((addressProp.properties as Record<string, unknown>).street).toBeDefined();
        });

        it('should handle arrays', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                tags: s.array(s.string()),
                scores: s.array(s.number())
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
            const tagsProp = (jsonSchema.properties as Record<string, unknown>).tags as Record<string, unknown>;
            const scoresProp = (jsonSchema.properties as Record<string, unknown>).scores as Record<string, unknown>;

            expect(tagsProp.type).toBe('array');
            expect((tagsProp.items as Record<string, unknown>).type).toBe('string');
            expect(scoresProp.type).toBe('array');
            expect((scoresProp.items as Record<string, unknown>).type).toBe('number');
        });

        it('should handle enum/literal constraints', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                status: s.string('active', 'inactive', 'pending'),
                priority: s.number(1, 2, 3)
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
            const statusProp = (jsonSchema.properties as Record<string, unknown>).status as Record<string, unknown>;
            const priorityProp = (jsonSchema.properties as Record<string, unknown>).priority as Record<string, unknown>;

            expect(statusProp.enum).toEqual(['active', 'inactive', 'pending']);
            expect(priorityProp.enum).toEqual([1, 2, 3]);
        });

        it('should exclude computed properties from input schema', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                fullName: x.computed((entity) => `${entity.firstName} ${entity.lastName}`)
            })).compile();

            const inputSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
            expect((inputSchema.properties as Record<string, unknown>).fullName).toBeUndefined();
        });

        it('should include computed properties in output schema', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                fullName: x.computed((entity) => `${entity.firstName} ${entity.lastName}`)
            })).compile();

            const outputSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', true);
            const fullNameProp = (outputSchema.properties as Record<string, unknown>).fullName as Record<string, unknown>;

            expect(fullNameProp).toBeDefined();
            expect(fullNameProp.type).toBe('object');
            expect((fullNameProp['x-routier'] as Record<string, unknown>).isComputed).toBe(true);
        });

        it('should store function source and injected value for computed properties', () => {
            const injectedValue = { prefix: 'Mr.' };
            const schema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                fullName: x.computed((entity, collectionName, injected) =>
                    `${injected.prefix} ${entity.firstName} ${entity.lastName}`,
                    injectedValue
                )
            })).compile();

            const outputSchema = compiledSchemaToJsonSchema(schema, 'draft-2020-12', true);
            const fullNameProp = (outputSchema.properties as Record<string, unknown>).fullName as Record<string, unknown>;
            const routierMeta = (fullNameProp['x-routier'] as Record<string, unknown>);

            expect(routierMeta.functionSource).toBeDefined();
            expect(typeof routierMeta.functionSource).toBe('string');
            expect(routierMeta.injected).toEqual(injectedValue);
        });

        it('should handle different JSON Schema draft versions', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                name: s.string().nullable()
            }).compile();

            const draft2020 = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
            const draft07 = compiledSchemaToJsonSchema(schema, 'draft-07', false);

            expect(draft2020.$schema).toContain('2020-12');
            expect(draft07.$schema).toContain('draft-07');

            const nameProp2020 = (draft2020.properties as Record<string, unknown>).name as Record<string, unknown>;
            const nameProp07 = (draft07.properties as Record<string, unknown>).name as Record<string, unknown>;

            expect(Array.isArray(nameProp2020.type) && nameProp2020.type.includes('null')).toBe(true);
            expect(nameProp07.nullable).toBe(true);
        });
    });

    describe('rehydrateSchemaFromJsonSchema', () => {
        it('should rehydrate a simple schema from JSON Schema', () => {
            const originalSchema = s.define('users', {
                id: s.string().key().identity(),
                name: s.string(),
                age: s.number()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);

            expect(rehydrated.collectionName).toBe('users');
            const compiled = rehydrated.compile();
            expect(compiled.collectionName).toBe('users');
            expect(compiled.idProperties.length).toBe(1);
            expect(compiled.idProperties[0].name).toBe('id');
        });

        it('should preserve Routier metadata', () => {
            const originalSchema = s.define('users', {
                id: s.string().key().identity(),
                name: s.string().distinct(),
                email: s.string().readonly()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const idProp = compiled.properties.find(p => p.name === 'id');
            const nameProp = compiled.properties.find(p => p.name === 'name');
            const emailProp = compiled.properties.find(p => p.name === 'email');

            expect(idProp?.isKey).toBe(true);
            expect(idProp?.isIdentity).toBe(true);
            expect(nameProp?.isDistinct).toBe(true);
            expect(emailProp?.isReadonly).toBe(true);
        });

        it('should handle nullable and optional properties', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                name: s.string().nullable(),
                email: s.string().optional()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const nameProp = compiled.properties.find(p => p.name === 'name');
            const emailProp = compiled.properties.find(p => p.name === 'email');

            expect(nameProp?.isNullable).toBe(true);
            expect(emailProp?.isOptional).toBe(true);
        });

        it('should handle nested objects', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                address: s.object({
                    street: s.string(),
                    city: s.string(),
                    zip: s.string()
                })
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const addressProp = compiled.properties.find(p => p.name === 'address');
            expect(addressProp?.type).toBe('Object');
            expect(addressProp?.children.length).toBe(3);
        });

        it('should handle arrays', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                tags: s.array(s.string()),
                scores: s.array(s.number())
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const tagsProp = compiled.properties.find(p => p.name === 'tags');
            const scoresProp = compiled.properties.find(p => p.name === 'scores');

            expect(tagsProp?.type).toBe('Array');
            expect(scoresProp?.type).toBe('Array');
        });

        it('should handle arrays of objects', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                addresses: s.array(s.object({
                    street: s.string(),
                    city: s.string(),
                    zip: s.string()
                }))
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const addressesProp = compiled.properties.find(p => p.name === 'addresses');
            expect(addressesProp?.type).toBe('Array');
            expect(addressesProp?.innerSchema).toBeDefined();
        });

        it('should handle date properties', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                createdAt: s.date(),
                updatedAt: s.date().optional()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const createdAtProp = compiled.properties.find(p => p.name === 'createdAt');
            const updatedAtProp = compiled.properties.find(p => p.name === 'updatedAt');

            expect(createdAtProp?.type).toBe('Date');
            expect(updatedAtProp?.type).toBe('Date');
            expect(updatedAtProp?.isOptional).toBe(true);
        });

        it('should handle boolean properties', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                isActive: s.boolean(),
                isVerified: s.boolean().optional()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const isActiveProp = compiled.properties.find(p => p.name === 'isActive');
            const isVerifiedProp = compiled.properties.find(p => p.name === 'isVerified');

            expect(isActiveProp?.type).toBe('Boolean');
            expect(isVerifiedProp?.type).toBe('Boolean');
            expect(isVerifiedProp?.isOptional).toBe(true);
        });

        it('should handle default values', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                status: s.string().default('active'),
                count: s.number().default(0)
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const statusProp = compiled.properties.find(p => p.name === 'status');
            const countProp = compiled.properties.find(p => p.name === 'count');

            expect(statusProp?.defaultValue).toBe('active');
            expect(countProp?.defaultValue).toBe(0);
        });

        it('should handle index properties', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                email: s.string().index('email_idx'),
                username: s.string().index('username_idx', 'username_unique')
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const emailProp = compiled.properties.find(p => p.name === 'email');
            const usernameProp = compiled.properties.find(p => p.name === 'username');

            expect(emailProp?.indexes).toContain('email_idx');
            expect(usernameProp?.indexes).toContain('username_idx');
            expect(usernameProp?.indexes).toContain('username_unique');
        });

        it('should handle from properties (property mapping)', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                firstName: s.string().from('first_name'),
                lastName: s.string().from('last_name')
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const firstNameProp = compiled.properties.find(p => p.name === 'firstName');
            const lastNameProp = compiled.properties.find(p => p.name === 'lastName');

            expect(firstNameProp?.from).toBe('first_name');
            expect(lastNameProp?.from).toBe('last_name');
        });

        it('should handle composite primary keys', () => {
            const originalSchema = s.define('orders', {
                userId: s.string().key(),
                orderId: s.string().key(),
                item: s.string()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            expect(compiled.idProperties.length).toBe(2);
            expect(compiled.idProperties.map(p => p.name)).toContain('userId');
            expect(compiled.idProperties.map(p => p.name)).toContain('orderId');
        });

        it('should handle properties with both nullable and optional', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                description: s.string().nullable().optional()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const descProp = compiled.properties.find(p => p.name === 'description');
            expect(descProp?.isNullable).toBe(true);
            expect(descProp?.isOptional).toBe(true);
        });

        it('should store custom serialization metadata', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                dateField: s.date().serialize(d => d.toISOString()).deserialize(s => new Date(s))
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const dateProp = (jsonSchema.properties as Record<string, unknown>).dateField as Record<string, unknown>;
            const routierMeta = (dateProp['x-routier'] as Record<string, unknown>);

            expect(routierMeta.hasCustomSerialization).toBe(true);
        });

        it('should preserve custom serialization metadata (functions cannot be rehydrated)', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                createdAt: s.date().serialize(d => d.toISOString()).deserialize(s => new Date(s))
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const dateProp = (jsonSchema.properties as Record<string, unknown>).createdAt as Record<string, unknown>;
            const routierMeta = (dateProp['x-routier'] as Record<string, unknown>);

            expect(routierMeta.hasCustomSerialization).toBe(true);

            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();
            const createdAtProp = compiled.properties.find(p => p.name === 'createdAt');

            expect(createdAtProp?.type).toBe('Date');
            expect(createdAtProp?.valueSerializer).toBeNull();
            expect(createdAtProp?.valueDeserializer).toBeNull();
        });

        it('should handle enum/literal constraints', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                status: s.string('active', 'inactive', 'pending')
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const statusProp = compiled.properties.find(p => p.name === 'status');
            expect(statusProp?.literals).toEqual(['active', 'inactive', 'pending']);
        });

        it('should rehydrate computed properties', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                fullName: x.computed((entity) => `${entity.firstName} ${entity.lastName}`)
            })).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', true);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const fullNameProp = compiled.properties.find(p => p.name === 'fullName');
            expect(fullNameProp).toBeDefined();
            expect(fullNameProp?.type).toBe('Computed');
            expect(fullNameProp?.isUnmapped).toBe(true);
            expect(fullNameProp?.functionBody).toBeDefined();
        });

        it('should rehydrate computed properties with injected values', () => {
            const injectedValue = { prefix: 'Mr.' };
            const originalSchema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                fullName: x.computed((entity, collectionName, injected) =>
                    `${injected.prefix} ${entity.firstName} ${entity.lastName}`,
                    injectedValue
                )
            })).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', true);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const compiled = rehydrated.compile();

            const fullNameProp = compiled.properties.find(p => p.name === 'fullName');
            expect(fullNameProp).toBeDefined();
            expect(fullNameProp?.type).toBe('Computed');
            expect(fullNameProp?.injected).toEqual(injectedValue);
        });

        it('should execute computed properties correctly after rehydration', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                fullName: x.computed((entity) => `${entity.firstName} ${entity.lastName}`)
            })).compile();

            const testEntity = {
                id: '1',
                firstName: 'John',
                lastName: 'Doe'
            };

            const originalEnriched = originalSchema.postprocess(testEntity, 'proxy') as any;
            expect(originalEnriched.fullName).toBe('John Doe');

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', true);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const rehydratedCompiled = rehydrated.compile();

            const rehydratedEnriched = rehydratedCompiled.postprocess(testEntity, 'proxy') as any;
            expect(rehydratedEnriched.fullName).toBe('John Doe');
            expect(rehydratedEnriched.fullName).toBe(originalEnriched.fullName);
        });

        it('should execute computed properties with injected values correctly after rehydration', () => {
            const injectedValue = { prefix: 'Mr.', suffix: 'Jr.' };
            const originalSchema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                fullName: x.computed((entity, collectionName, injected) =>
                    `${injected.prefix} ${entity.firstName} ${entity.lastName} ${injected.suffix}`,
                    injectedValue
                )
            })).compile();

            const testEntity = {
                id: '1',
                firstName: 'John',
                lastName: 'Doe'
            };

            const originalEnriched = originalSchema.postprocess(testEntity, 'proxy') as any;
            expect(originalEnriched.fullName).toBe('Mr. John Doe Jr.');

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', true);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const rehydratedCompiled = rehydrated.compile();

            const rehydratedEnriched = rehydratedCompiled.postprocess(testEntity, 'proxy') as any;
            expect(rehydratedEnriched.fullName).toBe('Mr. John Doe Jr.');
            expect(rehydratedEnriched.fullName).toBe(originalEnriched.fullName);
        });

        it('should execute computed properties that use collectionName correctly after rehydration', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                firstName: s.string(),
                lastName: s.string()
            }).modify(x => ({
                documentType: x.computed((entity, collectionName) => collectionName)
            })).compile();

            const testEntity = {
                id: '1',
                firstName: 'John',
                lastName: 'Doe'
            };

            const originalEnriched = originalSchema.postprocess(testEntity, 'proxy') as any;
            expect(originalEnriched.documentType).toBe('users');

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', true);
            const rehydrated = rehydrateSchemaFromJsonSchema(jsonSchema);
            const rehydratedCompiled = rehydrated.compile();

            const rehydratedEnriched = rehydratedCompiled.postprocess(testEntity, 'proxy') as any;
            expect(rehydratedEnriched.documentType).toBe('users');
            expect(rehydratedEnriched.documentType).toBe(originalEnriched.documentType);
        });
    });

    describe('rehydrateSchemaFromJsonString', () => {
        it('should parse JSON string and rehydrate schema', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                name: s.string()
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const jsonString = JSON.stringify(jsonSchema);

            const rehydrated = rehydrateSchemaFromJsonString(jsonString);
            expect(rehydrated.collectionName).toBe('users');
        });

        it('should throw error for invalid JSON', () => {
            expect(() => {
                rehydrateSchemaFromJsonString('invalid json');
            }).toThrow('Invalid JSON string');
        });

        it('should throw error for invalid JSON Schema structure', () => {
            expect(() => {
                rehydrateSchemaFromJsonString('{"type": "object"}');
            }).toThrow('JSON Schema must have a properties object');
        });
    });

    describe('SchemaDefinition.fromJson', () => {
        it('should create compiled schema from JSON string', () => {
            const originalSchema = s.define('users', {
                id: s.string().key().identity(),
                name: s.string(),
                age: s.number()
            }).compile();

            const jsonSchema = originalSchema.definition['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
            const jsonString = JSON.stringify(jsonSchema);

            const rehydrated = SchemaDefinition.fromJson(jsonString);
            expect(rehydrated.collectionName).toBe('users');
            expect(rehydrated.idProperties.length).toBe(1);
            expect(rehydrated.idProperties[0].name).toBe('id');
        });

        it('should accept optional collection name override', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                name: s.string()
            }).compile();

            const jsonSchema = originalSchema.definition['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
            const jsonString = JSON.stringify(jsonSchema);

            const rehydrated = SchemaDefinition.fromJson(jsonString, 'customName');
            expect(rehydrated.collectionName).toBe('customName');
        });

        it('should use collection name from metadata if provided', () => {
            const originalSchema = s.define('users', {
                id: s.string().key(),
                name: s.string()
            }).compile();

            const jsonSchema = originalSchema.definition['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
            const jsonString = JSON.stringify(jsonSchema);

            const rehydrated = SchemaDefinition.fromJson(jsonString);
            expect(rehydrated.collectionName).toBe('users');
        });
    });

    describe('Round-trip serialization', () => {
        it('should preserve schema structure through serialize/deserialize', () => {
            const originalSchema = s.define('users', {
                id: s.string().key().identity(),
                firstName: s.string(),
                lastName: s.string(),
                age: s.number().optional(),
                email: s.string().distinct(),
                address: s.object({
                    street: s.string(),
                    city: s.string(),
                    zip: s.string()
                }),
                tags: s.array(s.string()),
                status: s.string('active', 'inactive')
            }).compile();

            // Serialize
            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const jsonString = JSON.stringify(jsonSchema);

            // Deserialize
            const rehydrated = SchemaDefinition.fromJson(jsonString);

            // Verify structure
            expect(rehydrated.collectionName).toBe(originalSchema.collectionName);
            expect(rehydrated.idProperties.length).toBe(originalSchema.idProperties.length);
            expect(rehydrated.idProperties[0].name).toBe(originalSchema.idProperties[0].name);
            expect(rehydrated.properties.length).toBeGreaterThan(0);

            // Verify specific properties
            const idProp = rehydrated.properties.find(p => p.name === 'id');
            const emailProp = rehydrated.properties.find(p => p.name === 'email');
            const ageProp = rehydrated.properties.find(p => p.name === 'age');
            const addressProp = rehydrated.properties.find(p => p.name === 'address');
            const tagsProp = rehydrated.properties.find(p => p.name === 'tags');
            const statusProp = rehydrated.properties.find(p => p.name === 'status');

            expect(idProp?.isKey).toBe(true);
            expect(idProp?.isIdentity).toBe(true);
            expect(emailProp?.isDistinct).toBe(true);
            expect(ageProp?.isOptional).toBe(true);
            expect(addressProp?.type).toBe('Object');
            expect(tagsProp?.type).toBe('Array');
            expect(statusProp?.literals).toEqual(['active', 'inactive']);
        });

        it('should handle complex nested structures', () => {
            const originalSchema = s.define('orders', {
                id: s.string().key(),
                customer: s.object({
                    id: s.string(),
                    name: s.string(),
                    address: s.object({
                        street: s.string(),
                        city: s.string()
                    })
                }),
                items: s.array(s.object({
                    productId: s.string(),
                    quantity: s.number(),
                    price: s.number()
                }))
            }).compile();

            const jsonSchema = compiledSchemaToJsonSchema(originalSchema, 'draft-2020-12', false);
            const jsonString = JSON.stringify(jsonSchema);
            const rehydrated = SchemaDefinition.fromJson(jsonString);

            const customerProp = rehydrated.properties.find(p => p.name === 'customer');
            expect(customerProp?.type).toBe('Object');
            expect(customerProp?.children.length).toBe(3);

            const addressChild = customerProp?.children.find(c => c.name === 'address');
            expect(addressChild?.type).toBe('Object');
            expect(addressChild?.children.length).toBe(2);

            const itemsProp = rehydrated.properties.find(p => p.name === 'items');
            expect(itemsProp?.type).toBe('Array');
        });
    });

    describe('createStandardJsonSchemaProps', () => {
        it('should create Standard JSON Schema props', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                name: s.string()
            }).compile();

            const props = createStandardJsonSchemaProps(schema);

            expect(props.version).toBe(1);
            expect(props.vendor).toBe('routier');
            expect(props.jsonSchema).toBeDefined();
            expect(typeof props.jsonSchema.input).toBe('function');
            expect(typeof props.jsonSchema.output).toBe('function');
        });

        it('should generate different schemas for input and output', () => {
            const schema = s.define('users', {
                id: s.string().key(),
                name: s.string()
            }).modify(x => ({
                computed: x.computed((entity) => `computed-${entity.name}`)
            })).compile();

            const props = createStandardJsonSchemaProps(schema);
            const inputSchema = props.jsonSchema.input({ target: 'draft-2020-12' });
            const outputSchema = props.jsonSchema.output({ target: 'draft-2020-12' });

            expect((inputSchema.properties as Record<string, unknown>).computed).toBeUndefined();
            expect((outputSchema.properties as Record<string, unknown>).computed).toBeDefined();
        });
    });
});
