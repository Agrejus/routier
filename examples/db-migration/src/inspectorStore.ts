import { OpContext } from './ops';
import { makeOrdersOnly } from './seed';
import { createPlugin, DbChoice, ShopStore } from './store';

export const INSPECTOR_ROWS = 2500;

const SEED_BATCH = 1000;

const inBatches = <T>(items: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export type InspectorStore = { store: ShopStore; context: OpContext };

export const inspectorDatabaseName = (engine: DbChoice): string => `inspector-${engine}`;

export async function seedInspectorStore(store: ShopStore, rows: number): Promise<InspectorStore> {
    const orders = makeOrdersOnly(rows);

    if (await store.orders.countAsync() !== orders.length) {
        await store.orders.removeAllAsync();
        await store.saveChangesAsync();

        for (const batch of inBatches(orders, SEED_BATCH)) {
            await store.orders.addAsync(...batch);
            await store.saveChangesAsync();
        }
    }

    return { store, context: { email: String(orders[Math.floor(orders.length / 2)].email) } };
}

export const openInspectorStore = (engine: DbChoice, rows: number): Promise<InspectorStore> =>
    seedInspectorStore(new ShopStore(createPlugin(engine, inspectorDatabaseName(engine))), rows);
