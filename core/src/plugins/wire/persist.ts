import { BulkPersistChanges, BulkPersistResult } from "../../collections";
import { CompiledSchema } from "../../schema";
import { ReadonlySchemaCollection } from "../../collections/ReadonlySchemaCollection";
import { SchemaResolver } from "./query";
import { SerializedPersistRequest, SerializedResponse, SerializedSchemaChanges } from "./types";

/**
 * Saves, in the form that survives a wire.
 *
 * Simpler than a query, because a change set holds no functions: adds, updates and removes are
 * entities, and an entity reaching a plugin has already been through `preprocess` — so it is in
 * STORAGE shape, where a Date is already an ISO string and a nested object is already whatever the
 * schema said to store. It is JSON by the time it gets here.
 *
 * Two things are deliberately left behind:
 *
 * - **Tags.** `SchemaPersistChanges.tags` is caller-side metadata for correlating a save with its
 *   echo locally. The receiver has no use for it and no business seeing it.
 * - **Schema ids.** Collections are NAMED. An id is a hash of the schema's own shape, so it would
 *   couple both sides to identical schema definitions; a name lets the receiver resolve its own.
 */

export const serializeBulkPersist = (
    changes: BulkPersistChanges,
    schemas: ReadonlySchemaCollection
): SerializedPersistRequest => {

    const serialized: SerializedSchemaChanges[] = [];

    for (const [schemaId, schemaChanges] of changes) {
        if (schemaChanges.hasItems === false) {
            continue;
        }

        const schema = schemas.get(schemaId);

        if (schema == null) {
            throw new Error(`Cannot serialize a save: no schema is registered for the id it names.  SchemaId: ${schemaId}`);
        }

        serialized.push({
            collectionName: schema.collectionName,
            adds: schemaChanges.adds as unknown[],
            updates: schemaChanges.updates.map(update => ({
                entity: update.entity,
                changeType: update.changeType,
                delta: update.delta,
                ...(update.concurrency != null && { concurrency: update.concurrency })
            })),
            removes: schemaChanges.removes as unknown[]
        });
    }

    return { kind: "persist", changes: serialized };
};

/**
 * Rebuilds a change set from its wire form, keyed by the RECEIVER's schema ids.
 *
 * @throws when a named collection is not one this store declares. A save aimed at data this side
 * does not have must not be silently dropped — the caller would be told it succeeded.
 */
export const deserializeBulkPersist = (
    request: SerializedPersistRequest,
    resolveSchema: SchemaResolver
): { changes: BulkPersistChanges; schemas: CompiledSchema<any>[] } => {

    const changes = new BulkPersistChanges();
    const schemas: CompiledSchema<any>[] = [];

    for (const schemaChanges of request.changes) {
        const schema = resolveSchema(schemaChanges.collectionName);

        if (schema == null) {
            throw new Error(
                `Cannot apply a save: this store has no collection named '${schemaChanges.collectionName}'.`
            );
        }

        schemas.push(schema);

        const resolved = changes.resolve(schema.id);
        resolved.adds = schemaChanges.adds as never[];
        resolved.updates = schemaChanges.updates.map(update => ({
            entity: update.entity as never,
            changeType: update.changeType,
            delta: update.delta as never,
            ...(update.concurrency != null && { concurrency: update.concurrency })
        })) as never[];
        resolved.removes = schemaChanges.removes as never[];
    }

    return { changes, schemas };
};

/**
 * Serializes the ECHO of a save — the part the change tracker cannot do without.
 *
 * A save's result is not a receipt. It carries the rows as the database wrote them, including any
 * identity the database assigned, and the change tracker matches each one back to the addition that
 * produced it. Returning a count instead would leave every inserted entity without its key.
 */
export const serializePersistResult = (
    result: BulkPersistResult,
    schemas: ReadonlySchemaCollection
): SerializedResponse => {

    const changes: Array<{ collectionName: string; adds: unknown[]; updates: unknown[]; removes: unknown[] }> = [];

    for (const [schemaId, schemaResult] of result) {
        const schema = schemas.get(schemaId);

        if (schema == null) {
            continue;
        }

        changes.push({
            collectionName: schema.collectionName,
            adds: schemaResult.adds as unknown[],
            updates: schemaResult.updates as unknown[],
            removes: schemaResult.removes as unknown[]
        });
    }

    return { ok: true, kind: "persist", changes };
};

/** Rebuilds a save's echo against the SENDER's schema ids, which is what its change tracker holds. */
export const deserializePersistResult = (
    response: Extract<SerializedResponse, { kind: "persist" }>,
    resolveSchema: SchemaResolver
): BulkPersistResult => {

    const result = new BulkPersistResult();

    for (const schemaChanges of response.changes) {
        const schema = resolveSchema(schemaChanges.collectionName);

        if (schema == null) {
            throw new Error(
                `A save came back naming a collection this store does not declare: '${schemaChanges.collectionName}'.`
            );
        }

        const resolved = result.resolve(schema.id);
        resolved.adds = schemaChanges.adds as never[];
        resolved.updates = schemaChanges.updates as never[];
        resolved.removes = schemaChanges.removes as never[];
    }

    return result;
};
