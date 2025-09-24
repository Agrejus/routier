import { IDbPlugin, uuidv4 } from "@routier/core";
import { DataStore } from "@routier/datastore";
import { productsSchema } from "../schemas/product";
import { commentsSchema } from "../schemas/comments";
import { eventsSchema } from "../schemas/event";
import { usersSchema } from "../schemas/user";
import { userProfileSchema } from "../schemas/userProfile";
import { inventoryItemsSchema } from "../schemas/inventoryItem";
import { playerSchema } from "../schemas/player";
import { playerMatchSchema } from "../schemas/playerMatch";
import { immutableItemSchema } from "../schemas/immutableItem";
import { CommentsView, commentsViewSchema } from "../schemas/commentsView";

export class TestDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...productsSchema }).create();
    comments = this.collection(commentsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...commentsSchema }).create();
    events = this.collection(eventsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...eventsSchema }).create();
    users = this.collection(usersSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...usersSchema }).create();
    userProfiles = this.collection(userProfileSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...userProfileSchema }).create();
    inventoryItems = this.collection(inventoryItemsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...inventoryItemsSchema }).create();

    players = this.collection(playerSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerSchema }).create();
    playerMatches = this.collection(playerMatchSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerMatchSchema }).create();

    immutableItems = this.collection(immutableItemSchema).readonly().create();

    commentsView = this.view(commentsViewSchema).derive((done) => {
        this.comments.subscribe().next().toArray(response => {

            if (response.ok === "error") {
                return done([]);
            }

            done(response.data.map(x => ({
                content: "hi",
                user: {
                    name: ""
                },
                createdAt: new Date(),
                replies: 1,
                id: uuidv4()
            } as CommentsView)))
        })
    }).create();
}