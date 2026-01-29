import { PropertyInfo } from '../PropertyInfo';
import { CompiledSchema, InferCreateType, InferType, SchemaTypes } from '../types';
import { SchemaBase } from '../property/base/SchemaBase';
import { SchemaArray } from '../property/types/SchemaArray';
import { SchemaDefinition } from '../SchemaDefinition';
import { s } from '../builder';

/**
 * Standard JSON Schema V1 interface types
 * Based on https://standardschema.dev/json-schema
 */
export interface StandardTypedV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardTypedV1.Props<Input, Output>;
}

export declare namespace StandardTypedV1 {
    export interface Props<Input = unknown, Output = Input> {
        readonly version: 1;
        readonly vendor: string;
        readonly types?: Types<Input, Output> | undefined;
    }

    export interface Types<Input = unknown, Output = Input> {
        readonly input: Input;
        readonly output: Output;
    }
}

export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardJSONSchemaV1.Props<Input, Output>;
}

export declare namespace StandardJSONSchemaV1 {
    export interface Props<Input = unknown, Output = Input>
        extends StandardTypedV1.Props<Input, Output> {
        readonly jsonSchema: StandardJSONSchemaV1.Converter;
    }

    export interface Converter {
        readonly input: (
            options: StandardJSONSchemaV1.Options
        ) => Record<string, unknown>;
        readonly output: (
            options: StandardJSONSchemaV1.Options
        ) => Record<string, unknown>;
    }

    export type Target =
        | 'draft-2020-12'
        | 'draft-07'
        | 'openapi-3.0'
        | ({} & string);

    export interface Options {
        readonly target: Target;
        readonly libraryOptions?: Record<string, unknown> | undefined;
    }
}

/**
 * Context for property conversion
 */
interface ConversionContext {
    target: StandardJSONSchemaV1.Target;
    visited: Set<string>;
    useOutputType: boolean;
    convertProperty: (property: PropertyInfo<any>) => Record<string, unknown>;
}

/**
 * Strategy interface for converting property types to JSON Schema
 */
type PropertyConverter = (
    property: PropertyInfo<any>,
    context: ConversionContext
) => Record<string, unknown>;

/**
 * Converts a primitive property with optional enum/literals
 */
function createPrimitiveConverter(
    jsonType: 'string' | 'number' | 'boolean'
): PropertyConverter {
    return (property, context) => {
        const jsonSchema: Record<string, unknown> = { type: jsonType };
        if (property.literals && property.literals.length > 0) {
            jsonSchema.enum = property.literals;
        }
        return jsonSchema;
    };
}

/**
 * Converts a Date property to JSON Schema
 */
const dateConverter: PropertyConverter = (_property, _context) => {
    return {
        type: 'string',
        format: 'date-time'
    };
};

/**
 * Converts an Object property to JSON Schema
 */
const objectConverter: PropertyConverter = (property, context) => {
    const jsonSchema: Record<string, unknown> = { type: 'object' };

    if (property.children && property.children.length > 0) {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        for (const child of property.children) {
            // Skip computed and function properties for input schemas
            // Include them in output schemas as they represent derived values
            if (!context.useOutputType && (child.type === SchemaTypes.Computed || child.type === SchemaTypes.Function)) {
                continue;
            }

            const childSchema = context.convertProperty(child);

            // Skip empty schemas (e.g., computed properties that return empty for input)
            if (Object.keys(childSchema).length === 0) {
                continue;
            }

            const propertyName = child.from || child.name;
            properties[propertyName] = childSchema;

            // Add to required if not optional and not nullable
            // Computed/function properties are never required in JSON Schema
            if (!child.isOptional && !child.isNullable &&
                child.type !== SchemaTypes.Computed && child.type !== SchemaTypes.Function) {
                required.push(propertyName);
            }
        }

        if (Object.keys(properties).length > 0) {
            jsonSchema.properties = properties;
        }
        if (required.length > 0) {
            jsonSchema.required = required;
        }
    } else {
        // Empty object or unknown structure
        jsonSchema.properties = {};
    }

    return jsonSchema;
};

/**
 * Converts array inner schema to JSON Schema items
 * Attempts to fully recurse into object schemas when possible
 */
function convertArrayItems(
    innerSchema: SchemaBase<any, any>,
    context: ConversionContext
): Record<string, unknown> {
    const innerType = innerSchema.type;

    switch (innerType) {
        case SchemaTypes.String:
            return { type: 'string' };
        case SchemaTypes.Number:
            return { type: 'number' };
        case SchemaTypes.Boolean:
            return { type: 'boolean' };
        case SchemaTypes.Date:
            return { type: 'string', format: 'date-time' };
        case SchemaTypes.Object:
            // Try to extract object structure from innerSchema.instance
            // For SchemaObject, instance contains the property definitions
            if (innerSchema.instance && typeof innerSchema.instance === 'object') {
                const properties: Record<string, unknown> = {};
                const required: string[] = [];

                // Iterate through the instance properties
                for (const [key, value] of Object.entries(innerSchema.instance)) {
                    if (value && typeof value === 'object' && 'type' in value) {
                        // This is a SchemaBase - try to convert it
                        const schemaBase = value as SchemaBase<any, any>;
                        const tempProperty = new PropertyInfo(schemaBase, key);

                        // Skip computed/function for input schemas
                        if (!context.useOutputType &&
                            (tempProperty.type === SchemaTypes.Computed || tempProperty.type === SchemaTypes.Function)) {
                            continue;
                        }

                        const itemSchema = context.convertProperty(tempProperty);
                        if (Object.keys(itemSchema).length > 0) {
                            properties[key] = itemSchema;
                            if (!tempProperty.isOptional && !tempProperty.isNullable &&
                                tempProperty.type !== SchemaTypes.Computed && tempProperty.type !== SchemaTypes.Function) {
                                required.push(key);
                            }
                        }
                    }
                }

                if (Object.keys(properties).length > 0) {
                    return {
                        type: 'object',
                        properties,
                        ...(required.length > 0 ? { required } : {})
                    };
                }
            }
            // Fallback for unknown object structure
            return {
                type: 'object',
                properties: {},
                description: 'Array item object schema'
            };
        case SchemaTypes.Array:
            // Nested arrays - recursively handle
            if (innerSchema instanceof SchemaArray && innerSchema.innerSchema) {
                return {
                    type: 'array',
                    items: convertArrayItems(innerSchema.innerSchema, context)
                };
            }
            return {
                type: 'array',
                items: { type: 'object' } // Simplified fallback
            };
        default:
            return { type: 'object' };
    }
}

/**
 * Converts an Array property to JSON Schema
 */
const arrayConverter: PropertyConverter = (property, context) => {
    const jsonSchema: Record<string, unknown> = { type: 'array' };

    if (property.innerSchema) {
        jsonSchema.items = convertArrayItems(property.innerSchema, context);
    } else {
        jsonSchema.items = { type: 'object' };
    }

    return jsonSchema;
};

/**
 * Converts computed/function properties to JSON Schema
 * For input schemas, these return empty (should be skipped)
 * For output schemas, we include them with a generic object type
 */
const computedConverter: PropertyConverter = (property, context) => {
    // For input schemas, computed/function properties are not part of the data shape
    if (!context.useOutputType) {
        return {};
    }

    // For output schemas, include computed properties
    // We can't know the exact return type without executing the function,
    // so we use a generic object type with a note
    const routierMeta: Record<string, unknown> = {
        isComputed: property.type === SchemaTypes.Computed,
        isFunction: property.type === SchemaTypes.Function
    };

    // Store function source code for rehydration
    if (property.functionBody) {
        try {
            routierMeta.functionSource = property.functionBody.toString();
        } catch (e) {
            // If function can't be serialized, store a placeholder
            routierMeta.functionSource = null;
        }
    }

    // Store injected value if it's serializable
    if (property.injected !== null && property.injected !== undefined) {
        try {
            // Try to serialize the injected value
            JSON.stringify(property.injected);
            routierMeta.injected = property.injected;
        } catch (e) {
            // If injected value can't be serialized, store null
            routierMeta.injected = null;
        }
    } else {
        routierMeta.injected = null;
    }

    return {
        type: 'object',
        description: property.type === SchemaTypes.Computed
            ? 'Computed property (derived value)'
            : 'Function property (derived value)',
        'x-routier': routierMeta
    };
};

/**
 * Default converter for unknown types
 */
const defaultConverter: PropertyConverter = () => {
    return { type: 'object' };
};

/**
 * Factory registry mapping SchemaTypes to converters
 */
const converterRegistry = new Map<SchemaTypes, PropertyConverter>([
    [SchemaTypes.String, createPrimitiveConverter('string')],
    [SchemaTypes.Number, createPrimitiveConverter('number')],
    [SchemaTypes.Boolean, createPrimitiveConverter('boolean')],
    [SchemaTypes.Date, dateConverter],
    [SchemaTypes.Object, objectConverter],
    [SchemaTypes.Array, arrayConverter],
    [SchemaTypes.Computed, computedConverter],
    [SchemaTypes.Function, computedConverter],
]);

/**
 * Applies nullable handling to a JSON Schema based on the target draft version
 */
function applyNullable(
    jsonSchema: Record<string, unknown>,
    property: PropertyInfo<any>,
    target: StandardJSONSchemaV1.Target
): void {
    if (!property.isNullable) {
        return;
    }

    if (target === 'draft-2020-12') {
        if (Array.isArray(jsonSchema.type)) {
            (jsonSchema.type as string[]).push('null');
        } else {
            jsonSchema.type = [jsonSchema.type as string, 'null'];
        }
    } else {
        jsonSchema.nullable = true;
    }
}

/**
 * Applies Routier-specific metadata to a JSON Schema
 */
function applyRoutierMetadata(
    jsonSchema: Record<string, unknown>,
    property: PropertyInfo<any>
): void {
    // Don't overwrite existing x-routier metadata (e.g., from computed properties)
    if (!jsonSchema['x-routier']) {
        jsonSchema['x-routier'] = {};
    }
    const routierMeta = jsonSchema['x-routier'] as Record<string, unknown>;

    // Only add metadata if it doesn't already exist (to preserve computed property metadata)
    if (property.isKey && !routierMeta.isKey) {
        routierMeta.isKey = true;
    }
    if (property.isIdentity && !routierMeta.isIdentity) {
        routierMeta.isIdentity = true;
    }
    if (property.isReadonly && !routierMeta.isReadonly) {
        routierMeta.isReadonly = true;
    }
    if (property.isDistinct && !routierMeta.isDistinct) {
        routierMeta.isDistinct = true;
    }
    if (property.indexes && property.indexes.length > 0 && !routierMeta.indexes) {
        routierMeta.indexes = property.indexes;
    }
    if ((property.valueSerializer || property.valueDeserializer) && !routierMeta.hasCustomSerialization) {
        routierMeta.hasCustomSerialization = true;
    }
    if (property.defaultValue != null && !routierMeta.hasDefault) {
        routierMeta.hasDefault = true;
        // Note: We can't serialize function defaults, only note their presence
        if (typeof property.defaultValue === 'function') {
            routierMeta.defaultIsFunction = true;
        } else {
            // For static defaults, we can include the actual value
            // Note: This includes falsy values like 0, false, empty string, etc.
            routierMeta.defaultValue = property.defaultValue;
        }
    }
    // Store the Routier property name in metadata (may differ from JSON Schema key if from() is used)
    if (!routierMeta.propertyName) {
        routierMeta.propertyName = property.name;
    }
    if (property.from != null && !routierMeta.from) {
        routierMeta.from = property.from;
    }
}

/**
 * Converts a Routier PropertyInfo to a JSON Schema property definition.
 */
export function propertyInfoToJsonSchema(
    property: PropertyInfo<any>,
    target: StandardJSONSchemaV1.Target,
    visited: Set<string> = new Set(),
    useOutputType: boolean = false
): Record<string, unknown> {
    // Create conversion context with recursive converter
    const context: ConversionContext = {
        target,
        visited,
        useOutputType,
        convertProperty: (prop) => propertyInfoToJsonSchema(prop, target, visited, useOutputType)
    };

    // Get converter from factory registry
    const converter = converterRegistry.get(property.type) ?? defaultConverter;

    // Convert the property
    const jsonSchema = converter(property, context);

    // Apply nullable handling
    applyNullable(jsonSchema, property, target);

    // Apply Routier-specific metadata
    applyRoutierMetadata(jsonSchema, property);

    return jsonSchema;
}

/**
 * Converts a CompiledSchema to a JSON Schema object schema.
 */
export function compiledSchemaToJsonSchema<T extends {}>(
    compiledSchema: CompiledSchema<T>,
    target: StandardJSONSchemaV1.Target,
    useOutputType: boolean = false
): Record<string, unknown> {
    const jsonSchema: Record<string, unknown> = {
        $schema: target === 'draft-2020-12'
            ? 'https://json-schema.org/draft/2020-12/schema'
            : target === 'draft-07'
                ? 'http://json-schema.org/draft-07/schema#'
                : 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {} as Record<string, unknown>,
        required: [] as string[]
    };

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    // Iterate through all properties
    for (const property of compiledSchema.properties) {
        // Skip computed and function properties for input schema
        // For output schema, we include computed properties
        if (!useOutputType && (property.type === SchemaTypes.Computed || property.type === SchemaTypes.Function)) {
            continue;
        }

        // Skip unmapped properties (except computed/function properties in output schema)
        if (property.isUnmapped && !(useOutputType && (property.type === SchemaTypes.Computed || property.type === SchemaTypes.Function))) {
            continue;
        }

        const propertySchema = propertyInfoToJsonSchema(property, target, new Set(), useOutputType);

        // Skip empty schemas (e.g., computed properties that return empty)
        if (Object.keys(propertySchema).length === 0) {
            continue;
        }

        const propertyName = property.from || property.name;
        properties[propertyName] = propertySchema;

        // Add to required if not optional and not nullable
        if (!property.isOptional && !property.isNullable) {
            required.push(propertyName);
        }
    }

    jsonSchema.properties = properties;
    if (required.length > 0) {
        jsonSchema.required = required;
    }

    // Add Routier-specific metadata
    jsonSchema['x-routier'] = {
        collectionName: compiledSchema.collectionName,
        idProperties: compiledSchema.idProperties.map(p => p.name),
        hasIdentities: compiledSchema.hasIdentities,
        hasIdentityKeys: compiledSchema.hasIdentityKeys
    };

    return jsonSchema;
}

/**
 * Creates Standard JSON Schema V1 props for a compiled schema.
 */
export function createStandardJsonSchemaProps<T extends {}>(
    compiledSchema: CompiledSchema<T>
): StandardJSONSchemaV1.Props<InferCreateType<T>, InferType<T>> {
    return {
        version: 1,
        vendor: 'routier',
        types: {
            input: undefined as any as InferCreateType<T>,
            output: undefined as any as InferType<T>
        },
        jsonSchema: {
            input: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
                return compiledSchemaToJsonSchema(compiledSchema, options.target, false);
            },
            output: (options: StandardJSONSchemaV1.Options): Record<string, unknown> => {
                return compiledSchemaToJsonSchema(compiledSchema, options.target, true);
            }
        }
    };
}

/**
 * Parses a JSON string containing a JSON Schema and rehydrates it into a Routier SchemaDefinition.
 * This is a convenience wrapper around `rehydrateSchemaFromJsonSchema` that handles JSON parsing.
 * 
 * @param jsonString - The JSON string containing the JSON Schema
 * @param collectionName - The collection name for the schema (if not in x-routier metadata)
 * @returns A SchemaDefinition that can be compiled
 * @throws Error if the JSON string is invalid or doesn't contain a valid JSON Schema
 */
export function rehydrateSchemaFromJsonString(
    jsonString: string,
    collectionName?: string
): SchemaDefinition<any> {
    try {
        const jsonSchema = JSON.parse(jsonString) as Record<string, unknown>;
        return rehydrateSchemaFromJsonSchema(jsonSchema, collectionName);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON string: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Rehydrates a JSON Schema back into a Routier SchemaDefinition.
 * This parses the JSON Schema structure and reconstructs the schema using Routier's builder API.
 * 
 * @param jsonSchema - The JSON Schema object to rehydrate
 * @param collectionName - The collection name for the schema (if not in x-routier metadata)
 * @returns A SchemaDefinition that can be compiled
 */
export function rehydrateSchemaFromJsonSchema(
    jsonSchema: Record<string, unknown>,
    collectionName?: string
): SchemaDefinition<any> {
    // Extract collection name - provided collectionName takes precedence over metadata
    const routierMeta = jsonSchema['x-routier'] as Record<string, unknown> | undefined;
    const finalCollectionName = collectionName || (routierMeta?.collectionName as string) || 'unknown';

    if (!jsonSchema.properties || typeof jsonSchema.properties !== 'object') {
        throw new Error('JSON Schema must have a properties object');
    }

    const properties = jsonSchema.properties as Record<string, unknown>;
    const required = (jsonSchema.required as string[] | undefined) || [];
    const schemaDefinition: Record<string, any> = {};
    const computedProperties: Array<{ name: string; isComputed: boolean; functionSource: string | null; injected: any }> = [];

    // Get idProperties from schema-level metadata as fallback
    const idProperties = (routierMeta?.idProperties as string[] | undefined) || [];

    for (const [propName, propSchema] of Object.entries(properties)) {
        const prop = propSchema as Record<string, unknown>;
        const isRequired = required.includes(propName);
        const routierPropMeta = prop['x-routier'] as Record<string, unknown> | undefined;

        // Use Routier property name from metadata if available, otherwise use JSON Schema property name
        const routierPropName = (routierPropMeta?.propertyName as string | undefined) || propName;

        // Check if this is a computed or function property
        if (routierPropMeta?.isComputed || routierPropMeta?.isFunction) {
            computedProperties.push({
                name: routierPropName,
                isComputed: routierPropMeta.isComputed === true,
                functionSource: (routierPropMeta.functionSource as string | null) || null,
                injected: routierPropMeta.injected !== undefined ? routierPropMeta.injected : null
            });
            continue;
        }

        // Convert JSON Schema property to Routier schema
        let schemaBuilder: any = convertJsonSchemaPropertyToRoutier(prop);

        // Apply Routier-specific modifiers (using type assertion for method chaining)
        // Note: Apply key() first as it's required for schema compilation
        // Check both property-level metadata and schema-level idProperties list
        const isKey = routierPropMeta?.isKey === true || idProperties.includes(routierPropName);
        if (isKey && typeof schemaBuilder.key === 'function') {
            schemaBuilder = schemaBuilder.key();
        }
        // Apply from() mapping early, as it's a fundamental property mapping
        if (routierPropMeta?.from && typeof schemaBuilder.from === 'function') {
            schemaBuilder = schemaBuilder.from(routierPropMeta.from as string);
        }
        if (routierPropMeta?.isIdentity && typeof schemaBuilder.identity === 'function') {
            schemaBuilder = schemaBuilder.identity();
        }
        if (routierPropMeta?.isReadonly && typeof schemaBuilder.readonly === 'function') {
            schemaBuilder = schemaBuilder.readonly();
        }
        if (routierPropMeta?.isDistinct && typeof schemaBuilder.distinct === 'function') {
            schemaBuilder = schemaBuilder.distinct();
        }
        // Apply optional if property is not required (nullable and optional are independent)
        if (!isRequired && typeof schemaBuilder.optional === 'function') {
            schemaBuilder = schemaBuilder.optional();
        }
        // Apply nullable if property allows null (nullable and optional are independent)
        if (prop.nullable === true || (Array.isArray(prop.type) && prop.type.includes('null'))) {
            if (typeof schemaBuilder.nullable === 'function') {
                schemaBuilder = schemaBuilder.nullable();
            }
        }
        if (routierPropMeta?.indexes && Array.isArray(routierPropMeta.indexes)) {
            if (typeof schemaBuilder.index === 'function') {
                schemaBuilder = schemaBuilder.index(...(routierPropMeta.indexes as string[]));
            }
        }

        // Apply default value if present (only static defaults, not function defaults)
        // hasDefault=true and defaultIsFunction=false means we have a static default value stored
        if (routierPropMeta?.hasDefault && !routierPropMeta.defaultIsFunction && routierPropMeta.hasOwnProperty('defaultValue')) {
            if (typeof schemaBuilder.default === 'function') {
                schemaBuilder = schemaBuilder.default(routierPropMeta.defaultValue);
            }
        }

        schemaDefinition[routierPropName] = schemaBuilder;
    }

    // Build base schema
    let schema = s.define(finalCollectionName, schemaDefinition);

    // Add computed properties via modify()
    if (computedProperties.length > 0) {
        schema = schema.modify(x => {
            const computedDefs: Record<string, any> = {};

            for (const computedProp of computedProperties) {
                if (computedProp.functionSource) {
                    // Recreate the function from source code
                    // The function signature is: (entity, collectionName, injected) => result
                    // We use new Function() to create the function, but wrap it so toString() returns the arrow function
                    let recreatedFn: any;
                    try {
                        const functionSource = computedProp.functionSource;

                        // Parse the arrow function to extract parameters and body
                        const arrowMatch = functionSource.match(/^\(([^)]*)\)\s*=>\s*(.+)$/s);

                        if (!arrowMatch) {
                            throw new Error('Function source is not an arrow function');
                        }

                        // Parse parameters
                        const paramsStr = arrowMatch[1].trim();
                        const params = paramsStr ? paramsStr.split(',').map(p => p.trim()).filter(p => p) : [];
                        const body = arrowMatch[2].trim();

                        // Create function body - if it's a block (starts with {), use as-is, otherwise wrap in return
                        const functionBody = body.startsWith('{')
                            ? body.slice(1, -1) // Remove outer braces
                            : `return ${body}`;

                        // Create the function using new Function()
                        // If no parameters, call with just the body; otherwise spread the params
                        const fn = params.length > 0
                            ? new Function(...params, functionBody)
                            : new Function(functionBody);

                        // Wrap it so toString() returns the original arrow function string
                        // This is needed because the schema system validates that functions are arrow functions
                        recreatedFn = Object.assign(fn, {
                            toString: () => functionSource
                        });
                    } catch (e) {
                        // If we can't recreate the function, create a placeholder arrow function that throws
                        recreatedFn = () => {
                            throw new Error(`Cannot recreate computed property ${computedProp.name}: ${e instanceof Error ? e.message : 'unknown error'}`);
                        };
                        // Ensure toString returns an arrow function for validation
                        Object.assign(recreatedFn, {
                            toString: () => `() => { throw new Error("Cannot recreate computed property ${computedProp.name}"); }`
                        });
                    }

                    // Add computed property with optional injected value
                    if (computedProp.isComputed) {
                        computedDefs[computedProp.name] = x.computed(recreatedFn, computedProp.injected);
                    } else {
                        computedDefs[computedProp.name] = x.function(recreatedFn, computedProp.injected);
                    }
                } else {
                    // No function source available - create a placeholder
                    computedDefs[computedProp.name] = computedProp.isComputed
                        ? x.computed(() => {
                            throw new Error(`Computed property ${computedProp.name} could not be rehydrated: function source not available`);
                        })
                        : x.function(() => {
                            throw new Error(`Function property ${computedProp.name} could not be rehydrated: function source not available`);
                        });
                }
            }

            return computedDefs;
        });
    }

    return schema;
}

/**
 * Converts a JSON Schema property definition to a Routier schema builder.
 */
function convertJsonSchemaPropertyToRoutier(
    prop: Record<string, unknown>
): SchemaBase<any, any> {
    const type = Array.isArray(prop.type)
        ? (prop.type as string[]).find(t => t !== 'null') || prop.type[0]
        : prop.type as string;

    // Check for date type - dates are serialized as string with format 'date-time'
    if (type === 'string' && prop.format === 'date-time') {
        return s.date();
    }

    switch (type) {
        case 'string':
            if (prop.enum && Array.isArray(prop.enum)) {
                return s.string(...(prop.enum as string[]));
            }
            return s.string();

        case 'number':
        case 'integer':
            if (prop.enum && Array.isArray(prop.enum)) {
                return s.number(...(prop.enum as number[]));
            }
            return s.number();

        case 'boolean':
            return s.boolean();

        case 'object':
            // Recurse into object properties
            if (prop.properties && typeof prop.properties === 'object') {
                const objectProps = prop.properties as Record<string, unknown>;
                const objectSchema: Record<string, any> = {};

                for (const [key, value] of Object.entries(objectProps)) {
                    objectSchema[key] = convertJsonSchemaPropertyToRoutier(value as Record<string, unknown>);
                }

                return s.object(objectSchema);
            }
            return s.object({});

        case 'array':
            // Handle array items
            if (prop.items && typeof prop.items === 'object') {
                const itemsSchema = convertJsonSchemaPropertyToRoutier(prop.items as Record<string, unknown>);
                return s.array(itemsSchema as any);
            }
            return s.array(s.object({}) as any);

        default:
            // Fallback to object for unknown types
            return s.object({});
    }
}

/**
 * Attempts to extract type information from a compiled schema for better type inference.
 * 
 * Note: TypeScript types are compile-time only, so we can't extract actual type information at runtime.
 * The Standard JSON Schema spec allows libraries to advertise their inferred types via the `types` property,
 * but this requires compile-time type information that isn't available at runtime.
 * 
 * For proper type inference, consumers should use TypeScript's type system:
 * ```typescript
 * const schema = s.define("users", { ... }).compile();
 * type User = InferType<typeof schema>;
 * type CreateUser = InferCreateType<typeof schema>;
 * ```
 * 
 * @param compiledSchema - The compiled schema to extract type info from
 * @returns A description of the type names (for documentation purposes only)
 */
export function extractTypeInfo<T extends {}>(
    compiledSchema: CompiledSchema<T>
): { inputType: string; outputType: string } {
    return {
        inputType: `InferCreateType<${compiledSchema.collectionName}>`,
        outputType: `InferType<${compiledSchema.collectionName}>`
    };
}
