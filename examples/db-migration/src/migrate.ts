import { ShopStore } from './store';

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

const CHUNK = 1000;

async function copyCollection(source: ShopStore, target: ShopStore, schema: any): Promise<number> {
    const from = source.getCollection(schema);
    const to = target.getCollection(schema);

    const rows = await from.toArrayAsync() as Record<string, unknown>[];
    // The identity properties belong to the database that assigned them, so the target assigns
    // its own. Taken from the schema rather than named here, which is what keeps this generic.
    const assigned = schema.idProperties.map((property: { name: string }) => property.name);

    for (let i = 0; i < rows.length; i += CHUNK) {
        await to.addAsync(...rows.slice(i, i + CHUNK).map(row => withoutKeys(row, assigned)) as never[]);
        // Saved a chunk at a time: one save of every collection at the end would hold the whole
        // dataset as pending changes.
        await target.saveChangesAsync();
    }

    return rows.length;
}

const withoutKeys = (row: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
    Object.fromEntries(Object.entries(row).filter(([key]) => keys.includes(key) === false));
