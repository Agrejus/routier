import { product } from "./schemas/product";
import { DexiePlugin } from "routier-plugin-dexie";
import { DataStore } from 'routier';
import { MemoryPlugin } from "routier-plugin-memory";
import { DbPluginLoggingCapability, OptimisticReplicationDbPlugin } from "routier-core/plugins";

const plugin = new DexiePlugin("my-db");
const memory = new MemoryPlugin();
const loggingCapability = new DbPluginLoggingCapability();

loggingCapability.apply(plugin);
loggingCapability.apply(memory);

// We should inherit from/mixin the class, not wrap
const optimisticPlugin = OptimisticReplicationDbPlugin.create({
    source: plugin,
    read: memory,
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