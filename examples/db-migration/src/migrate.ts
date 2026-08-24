import { CompiledSchema } from '@routier/core/schema';
import { ShopStore } from './store';

/**
 * A schema whose entity type is not known here.
 *
 * `any` rather than `Record<string, unknown>`, which is what `store.schemas` hands out. That
 * type says the properties are `unknown` VALUES, and the schema's create-type inference reads a
 * non-schema property as no property at all, so `addAsync` ends up demanding
 * `{ [x: string]: never }` and every row has to be cast. The entity type here is genuinely
 * unknown, and `any` is how that is spelled without lying about the shape.
 */
type AnySchema = CompiledSchema<any>;

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

        await to.addAsync(...chunk);
        await target.saveChangesAsync();
    }

    return rows.length;
}

/**
 * Drops the properties the source database assigned, so the target assigns its own.
 *
 * Read off the schema rather than named here. That is what keeps this generic, and it is why
 * PouchDB's `_id` and `_rev` stay behind without this file ever mentioning PouchDB.
 *
 * **This is only safe because nothing here references anything.** These collections have no
 * foreign keys: an order carries a customer NAME, not a customer id. Drop an assigned id in a
 * schema where another collection points at it and every one of those references is now
 * dangling, silently, because the target handed out different ids.
 *
 * A schema with references needs the old id kept long enough to rewrite them: copy the parents
 * first, keep a map from old id to new, then rewrite the child's foreign key as it is copied.
 * Or carry the ids over unchanged, which works when the target is not assigning its own.
 */
function withoutAssignedIds(row: Record<string, unknown>, schema: AnySchema) {
    const assigned = schema.idProperties.map(property => property.name);

    return Object.fromEntries(
        Object.entries(row).filter(([key]) => assigned.includes(key) === false)
    );
}
