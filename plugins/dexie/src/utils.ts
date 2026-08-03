import { CompiledSchema, logger, PropertyInfo, SchemaTypes } from "@routier/core";

export const convertToDexieSchema = <T extends {}>(schema: CompiledSchema<T>) => {
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

    for (let i = 0, length = schema.properties.length; i < length; i++) {
        const property = schema.properties[i];

        if (compositeKey && property.isKey) {
            // Already part of the compound primary key
            continue;
        }

        if (property.level > 1) {
            logger.warn(`Dexie does not support querying on nested objects.  Property: ${property.getPathArray().join(".")}`);
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
        const connections = schema.properties.filter(w =>
            w !== property && // Don't match with self
            w.indexes.some(index => property.indexes.includes(index))
        );

        const properties = [property.name, ...connections.map(w => w.name)];

        existingIndexes.push(...connections);

        if (properties.length === 1) {
            // Not a compound property
            schemaProperties.push(properties[0]);
            continue;
        }

        schemaProperties.push(`[${properties.join("+")}]`);
    }

    return schemaProperties.join(",");
}