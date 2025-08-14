import { product } from "./schemas/product";
import { DexiePlugin } from "routier-plugin-dexie";
import { DataStore } from 'routier';
import { DbPluginLogging, OptimisticDbPluginReplicator } from "routier-core";
import { MemoryPlugin } from "../../../plugins/memory/dist";

const plugin = new DexiePlugin("my-db");

// We should inherit from/mixin the class, not wrap
const optimisticPlugin = OptimisticDbPluginReplicator.create({
    source: DbPluginLogging.wrap({
        Instance: DexiePlugin,
        args: "mydb"
    }),
    read: DbPluginLogging.wrap({
        Instance: MemoryPlugin
    }),
    replicas: []
});

export class DexieStore extends DataStore {

    constructor() {
        super(optimisticPlugin);
    }

    products = this.collection(product).create();
}

export const useDataStore = () => {
    return new DexieStore();
}