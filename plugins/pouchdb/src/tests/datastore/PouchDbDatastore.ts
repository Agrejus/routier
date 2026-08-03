import { IDbPlugin } from "@routier/core";
import { DataStore } from "@routier/datastore";
import { productsSchema } from "../schemas/product";
import { commentsSchema } from "../schemas/comments";
import { eventsSchema } from "../schemas/event";
import { usersSchema } from "../schemas/user";
import { userProfileSchema } from "../schemas/userProfile";
import { inventoryItemsSchema } from "../schemas/inventoryItem";
import { playerSchema } from "../schemas/player";
import { playerMatchSchema } from "../schemas/playerMatch";

export class TestDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...productsSchema }).proxy().create();
    comments = this.collection(commentsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...commentsSchema }).proxy().create();
    events = this.collection(eventsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...eventsSchema }).proxy().create();
    users = this.collection(usersSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...usersSchema }).proxy().create();
    userProfiles = this.collection(userProfileSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...userProfileSchema }).proxy().create();
    inventoryItems = this.collection(inventoryItemsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...inventoryItemsSchema }).proxy().create();

    players = this.collection(playerSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerSchema }).proxy().create();
    playerMatches = this.collection(playerMatchSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerMatchSchema }).proxy().create();
}