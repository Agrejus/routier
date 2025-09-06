import { product } from "./schemas/product";
import { DexiePlugin } from "@routier/dexie-plugin";
import { DataStore } from '../../../datastore/dist';
import { MemoryPlugin } from "@routier/memory-plugin";
import { DbPluginLoggingCapability, OptimisticReplicationDbPlugin } from "@routier/core/plugins";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";
import { UnknownRecord } from "@routier/core/utilities";
import { SchemaCollection } from "@routier/core/collections";
import { assertIsNotNull } from "@routier/core";

const dexie = new DexiePlugin("my-db");
const memory = new MemoryPlugin();
const loggingCapability = new DbPluginLoggingCapability();

loggingCapability.apply(dexie);
loggingCapability.apply(memory);

// We should inherit from/mixin the class, not wrap
const optimisticPlugin = OptimisticReplicationDbPlugin.create({
    source: dexie,
    read: memory,
    replicas: []
});

// const pouchDbPlugin = new PouchDbPlugin("pouchdb-sync-db", {
//     sync: {
//         remoteDb: "http://127.0.0.1:3000/pouchdb-sync-db",
//         live: true,
//         retry: true,
//         onChange: (schemas: SchemaCollection, change: PouchDB.Replication.SyncResult<any>) => {

//             if (change.direction === "pull") {
//                 const docs = change.change.docs.reduce((a, v) => ({ ...a, [v.documentType]: [...(a[v.documentType] ?? []), v] }), {} as { [key: string]: UnknownRecord[] });

//                 for (const documentType in docs) {
//                     const schema = schemas.getByName(documentType);

//                     assertIsNotNull(schema);

//                     const subscription = schema.createSubscription();

//                     subscription.send({
//                         adds: [],
//                         removals: [],
//                         updates: [],
//                         unknown: docs
//                     });

//                     subscription[Symbol.dispose]();
//                 }
//             }

//         }
//     }
// });

export class DexieStore extends DataStore {

    constructor() {
        super(optimisticPlugin);
    }

    products = this.collection(product).create();
}

export const useDataStore = () => {
    return new DexieStore();
}