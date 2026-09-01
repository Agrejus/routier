import { CompiledSchema, logger, PropertyInfo, SchemaTypes } from "@routier/core";

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

    for (let i = 0, length = schema.properties.length; i < length; i++) {
        const property = schema.properties[i];

        if (compositeKey && property.isKey) {
            // Already part of the compound primary key
            continue;
        }

        /**
         * Root properties only.
         *
         * A root property is level 0 and its children are level 1, so `level > 1` skipped
         * only grandchildren: the direct children of a nested object were emitted into the
         * stores string as if they were top-level properties. A schema with
         * `file: s.object({ key, size })` produced `...,file,key,size` — two indexes on
         * paths that do not exist at the root.
         *
         * Wasteful on its own, and fatal in pairs. Two nested objects sharing a child name —
         * `original.size` and `thumbnail.size`, which is what any schema with a file and its
         * thumbnail looks like — emitted `size` twice, and IndexedDB refuses the duplicate:
         * the database failed to OPEN with `ConstraintError`, so the whole store was
         * unusable rather than merely unindexed.
         */
        if (property.level > 0) {
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

    return schemaProperties.join(",");
}