import { DataStore } from "routier";
import { IDbPlugin } from "routier-core";
import { productsSchema } from "../schemas/product";
import { commentsSchema } from "../schemas/comments";
import { eventsSchema } from "../schemas/event";

export class TestDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).create();
    comments = this.collection(commentsSchema).create();
    events = this.collection(eventsSchema).create();
}