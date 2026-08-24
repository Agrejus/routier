import { Collection, DataStore } from '@routier/datastore';
import type { IDbPlugin } from '@routier/core/plugins';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import { PouchDbPlugin } from '@routier/pouchdb-plugin';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { BrowserStoragePlugin } from '@routier/browser-storage-plugin';
import { PGliteDbPlugin } from '@routier/pglite-plugin';
import { deleteDataDir, resolveDataDir } from '@routier/pglite-plugin/browser-storage';
import {
    customerSchema, invoiceSchema, orderSchema, productSchema,
    reviewSchema, shipmentSchema, supplierSchema,
} from './schemas';

export type DbChoice = 'memory' | 'localstorage' | 'dexie' | 'pouchdb' | 'sqlite' | 'pglite';

export function createPlugin(choice: DbChoice, databaseName: string): IDbPlugin {
    switch (choice) {
        case 'memory': return new MemoryPlugin(databaseName);
        case 'localstorage': return new BrowserStoragePlugin(databaseName, localStorage);
        case 'dexie': return new DexiePlugin(databaseName);
        case 'pouchdb': return new PouchDbPlugin(databaseName);
        case 'sqlite': return new SqliteDbPlugin(`${databaseName}.db`);
        case 'pglite': return new PGliteDbPlugin(databaseName);
    }
}

/** A fresh name per journey, so no run ever reads another run's data. */
export const databaseNameFor = (stamp: number, db: DbChoice): string => `shop-${stamp}-${db}`;

const CREATED_PGLITE_DATABASES = 'routier-lab-pglite-databases';

/** Names this page has opened. Their storage is in use, whatever the stored record says. */
const openedThisPage = new Set<string>();

const recorded = (): string[] => {
    try {
        const stored = JSON.parse(localStorage.getItem(CREATED_PGLITE_DATABASES) ?? '[]');

        return Array.isArray(stored) ? stored.filter(name => typeof name === 'string') : [];
    } catch {
        return [];
    }
};

const record = (names: Iterable<string>): void =>
    localStorage.setItem(CREATED_PGLITE_DATABASES, JSON.stringify([...names]));

/**
 * Removes the PGlite databases earlier visits created, and records this journey's own.
 *
 * `destroy` deletes, so the benchmark cleans up after itself. A migration journey never
 * destroys — the whole point is that the data is still there — so its ~40MB installation
 * outlives the page. This is what collects it on the next visit.
 *
 * A name is dropped from the record only once its storage is actually gone, and never while
 * this page still has it open: the benchmark builds a journey per engine, each sweeping under
 * its own name, and a live migration journey must not be deleted out from under itself.
 */
export async function removeStalePGliteDatabases(keep: string): Promise<void> {
    openedThisPage.add(keep);

    const stored = new Set([...recorded(), keep]);

    record(stored);

    const stale = [...stored].filter(name => !openedThisPage.has(name));

    const removed = await Promise.all(stale.map(async name => {
        try {
            await deleteDataDir(resolveDataDir(name, navigator.userAgent));

            return name;
        } catch {
            // Still there. Keeping it recorded is what makes the next visit try again.
            return null;
        }
    }));

    for (const name of removed) {
        if (name != null) {
            stored.delete(name);
        }
    }

    record(stored);
}

export class ShopStore extends DataStore {
    orders = this.collection(orderSchema).proxy().create();
    products = this.collection(productSchema).proxy().create();
    customers = this.collection(customerSchema).proxy().create();
    suppliers = this.collection(supplierSchema).proxy().create();
    invoices = this.collection(invoiceSchema).proxy().create();
    shipments = this.collection(shipmentSchema).proxy().create();
    reviews = this.collection(reviewSchema).proxy().create();

    /**
     * Every writable collection on this store, for code that should not have to name them.
     *
     * `DataStore.collections` is protected, so this is the seam: a subclass can expose it, an
     * outside helper cannot reach it. That is what lets the migration copy whatever the store
     * happens to hold rather than a hand-written list that drifts as collections are added.
     *
     * Views live in the same map and are not writable — a `ReadonlyCollection` has no `addAsync`
     * — so a migration that took everything would fail on the first one. Filtered by type rather
     * than by probing for the method, which would also accept anything that happened to have it.
     */
    all(): { name: string; collection: AnyCollection }[] {
        return [...this.collections.values()]
            .filter(collection => collection instanceof Collection)
            .map(collection => ({
                name: collection.schema.collectionName,
                collection: collection as unknown as AnyCollection,
            }));
    }
}

/**
 * A collection whose entity type is not known here. The migration reads rows out and puts them
 * back without looking inside them, so the shape is the schema's business rather than its own.
 */
export type AnyCollection = {
    schema: { collectionName: string; idProperties: { name: string }[] };
    toArrayAsync(): Promise<Record<string, unknown>[]>;
    addAsync(...entities: Record<string, unknown>[]): Promise<unknown>;
    countAsync(): Promise<number>;
};
