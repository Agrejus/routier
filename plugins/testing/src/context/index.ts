import { DataStore } from "../../../../datastore/dist";
import { IDbPlugin } from "@routier/core";
import { productsSchema } from "../schemas/product";
import { commentsSchema } from "../schemas/comments";
import { eventsSchema } from "../schemas/event";
import { usersSchema } from "../schemas/user";
import { userProfileSchema } from "../schemas/userProfile";
import { inventoryItemsSchema } from "../schemas/inventoryItem";

export class TestDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).create();
    comments = this.collection(commentsSchema).create();
    events = this.collection(eventsSchema).create();
    users = this.collection(usersSchema).create();
    userProfiles = this.collection(userProfileSchema).create();
    inventoryItems = this.collection(inventoryItemsSchema).create();
}