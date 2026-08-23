import { ShopStore } from './store';

/**
 * The whole migration: select everything out of the source, insert it into the target.
 * Both stores share the schema, so there is nothing to map. This file is displayed
 * verbatim in the UI.
 */
export async function migrate(source: ShopStore, target: ShopStore): Promise<number> {
    const rows = await source.orders.toArrayAsync();

    for (let i = 0; i < rows.length; i += 1000) {
        // _id is an identity key, so the target database assigns fresh ones. _rev is
        // PouchDB's revision marker and belongs to the source, so it stays behind too.
        const chunk = rows.slice(i, i + 1000).map(({ _id, _rev, ...rest }) => rest);
        await target.orders.addAsync(...chunk);
        await target.saveChangesAsync();
    }

    return rows.length;
}
