import { DbPluginLogging } from "routier-core";
import { product } from "./schemas/product";
import { DexiePlugin } from "routier-plugin-dexie";
import { DataStore } from 'routier';

const plugin = new DexiePlugin("dexie-db");
const pluginWithLogging = DbPluginLogging.create(plugin);


export class CustomContext extends DataStore {

    constructor() {
        super(plugin);
    }

    // constructor() {
    //     super(new MemoryPlugin())
    // }

    products = this.collection(product).create();
}

export const useDataStore = () => {
    return new CustomContext();
}