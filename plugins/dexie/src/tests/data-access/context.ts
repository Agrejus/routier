import { IDbPlugin } from "@routier/core";
import { DataStore } from "@routier/datastore";
import { productsSchema } from "./schemas/product";
import { usersSchema } from "./schemas/user";

export class DexieDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).scope(([x, p]) => x.collectionName === p.collectionName, { ...productsSchema }).create();
    users = this.collection(usersSchema).scope(([x, p]) => x.collectionName === p.collectionName, { ...productsSchema }).create();
}