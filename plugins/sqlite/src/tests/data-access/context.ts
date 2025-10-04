import { IDbPlugin } from "@routier/core";
import { DataStore } from "@routier/datastore";
import { productsSchema } from "./schemas/product";
import { usersSchema } from "./schemas/user";

export class SqliteDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).create();
    users = this.collection(usersSchema).create();
}