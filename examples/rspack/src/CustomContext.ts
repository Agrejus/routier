import { DataContext } from "../../../routeer/dist"
import { DbPluginLogging } from "routier-core";
import { product } from "./schemas/product";
import { DexiePlugin } from "routier-plugin-dexie";

const plugin = new DexiePlugin("dexie-db");
const pluginWithLogging = DbPluginLogging.create(plugin);


export class CustomContext extends DataContext {

    constructor() {
        super(pluginWithLogging);
    }

    // constructor() {
    //     super(new MemoryPlugin())
    // }

    products = this.collection(product).create();
}