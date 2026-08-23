import { DataStore } from '@routier/datastore';
import type { IDbPlugin } from '@routier/core/plugins';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import { PouchDbPlugin } from '@routier/pouchdb-plugin';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { BrowserStoragePlugin } from '@routier/browser-storage-plugin';
import { orderSchema } from './schemas';

export type DbChoice = 'memory' | 'localstorage' | 'dexie' | 'pouchdb' | 'sqlite';

export function createPlugin(choice: DbChoice, databaseName: string): IDbPlugin {
    switch (choice) {
        case 'memory': return new MemoryPlugin(databaseName);
        case 'localstorage': return new BrowserStoragePlugin(databaseName, localStorage);
        case 'dexie': return new DexiePlugin(databaseName);
        case 'pouchdb': return new PouchDbPlugin(databaseName);
        case 'sqlite': return new SqliteDbPlugin(`${databaseName}.db`);
    }
}

export class ShopStore extends DataStore {
    orders = this.collection(orderSchema).proxy().create();
}
