import { CompiledSchema, IdType, InferType, logger, PropertyInfo, SchemaTypes } from "@routier/core";
import type { UnknownRecord } from "@routier/core/utilities";

const compoundIndexPartners = <T extends {}>(schema: CompiledSchema<T>, property: PropertyInfo<T>) =>
    schema.properties.filter(other =>
        other !== property &&
        other.indexes.some(index => property.indexes.includes(index))
    );

export const compoundIndexGroupOf = <T extends {}>(schema: CompiledSchema<T>, property: PropertyInfo<T>): string[] =>
    [property.name, ...compoundIndexPartners(schema, property).map(partner => partner.name)];

const storesCache = new WeakMap<CompiledSchema<any>, string>();

export const convertToDexieSchema = <T extends {}>(schema: CompiledSchema<T>) => {
    const cached = storesCache.get(schema);

    if (cached != null) {
        return cached;
    }

    const stores = deriveDexieSchema(schema);

    storesCache.set(schema, stores);
    return stores;
};

const deriveDexieSchema = <T extends {}>(schema: CompiledSchema<T>) => {
    const schemaProperties: string[] = [];
    const existingIndexes: PropertyInfo<any>[] = [];

    // Dexie's primary key is the FIRST entry in the stores string. A schema with
    // multiple key properties needs a compound primary key ([a+b]) emitted first —
    // listing the keys as plain entries makes only the first one the primary key,
    // collapsing entities that differ in a later key component.
    const compositeKey = schema.idProperties.length > 1;

    if (compositeKey) {
        schemaProperties.push(`[${schema.idProperties.map(p => p.name).join("+")}]`);
    }

    const nestedPaths: string[] = [];

    for (let i = 0, length = schema.properties.length; i < length; i++) {
        const property = schema.properties[i];

        if (compositeKey && property.isKey) {
            // Already part of the compound primary key
            continue;
        }

        if (property.level > 0) {
            nestedPaths.push(property.getPathArray().join("."));
            continue;
        }

        if (existingIndexes.includes(property)) {
            continue;
        }

        let modifier = "";

        if (property.isKey && property.isIdentity) {
            // Auto increment (numbers only)
            modifier += "++";
        }

        if (property.type === SchemaTypes.Array) {
            // Multi entry index (arrays)
            modifier += "*";
        }

        if (property.isDistinct === true) {
            // Unique Index
            modifier += "&";
        }

        // Handle single property
        if (property.indexes.length === 0) {

            if (modifier) {
                // Handle the primary key
                schemaProperties.push(`${modifier}${property.name}`);
            } else {
                // Add the plain property
                schemaProperties.push(property.name);
            }

            continue;
        }

        // Test for compound indexes
        const connections = compoundIndexPartners(schema, property);

        const properties = compoundIndexGroupOf(schema, property);

        existingIndexes.push(...connections);

        if (properties.length === 1) {
            // Not a compound property
            schemaProperties.push(properties[0]);
            continue;
        }

        schemaProperties.push(`[${properties.join("+")}]`);
    }

    if (nestedPaths.length > 0) {
        logger.warn(`Dexie does not support querying on nested objects. Collection: ${schema.collectionName}. Properties: ${nestedPaths.join(", ")}`);
    }

    return schemaProperties.join(",");
}

export type DexieKey = IdType | IdType[];

export const dexieKey = (schema: CompiledSchema<UnknownRecord>, entity: InferType<UnknownRecord>): DexieKey => {
    const ids = schema.getIds(entity);
    return schema.idProperties.length === 1 ? ids[0] : ids;
};

