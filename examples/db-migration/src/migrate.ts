import { CompiledSchema } from '@routier/core/schema';
import { ShopStore } from './store';

type AnySchema = CompiledSchema<Record<string, unknown>>;

/** Saved a chunk at a time. One save at the end would hold the whole dataset as pending changes. */
const CHUNK = 1000;

/**
 * The whole migration: for every collection on the store, select everything out of the source
 * and insert it into the target. Both stores share the schemas, so there is nothing to map.
 * This file is displayed verbatim in the UI.
 */
export async function migrate(source: ShopStore, target: ShopStore): Promise<number> {
    let copied = 0;

    for (const [, schema] of source.schemas) {
        copied += await copyCollection(source, target, schema);
    }

    return copied;
}

async function copyCollection(source: ShopStore, target: ShopStore, schema: AnySchema): Promise<number> {
    const rows = await source.getCollection(schema).toArrayAsync();
    const to = target.getCollection(schema);

    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map(row => withoutAssignedIds(row, schema));

        // Iterating `schemas` erases the entity type, so these are records as far as the
        // compiler knows. They are the right shape, it just cannot be shown that here.
        await to.addAsync(...chunk as never[]);
        await target.saveChangesAsync();
    }

    return rows.length;
}

/**
 * Drops the properties the source database assigned, so the target assigns its own.
 *
 * Read off the schema rather than named here. That is what keeps this generic, and it is why
 * PouchDB's `_id` and `_rev` stay behind without this file ever mentioning PouchDB.
 */
function withoutAssignedIds(row: Record<string, unknown>, schema: AnySchema) {
    const assigned = schema.idProperties.map(property => property.name);

    return Object.fromEntries(
        Object.entries(row).filter(([key]) => assigned.includes(key) === false)
    );
}
