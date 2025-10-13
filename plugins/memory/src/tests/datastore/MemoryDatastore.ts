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
import { productsViewSchema } from "../schemas/productView";

export class TestDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...productsSchema }).create();
    productsView = this.view(productsViewSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...productsSchema }).derive((done) => {
        const unsubscribe = this.products.subscribe().toArray(productsResponse => {

            if (productsResponse.ok === "error") {
                return // do nothing
            }

            done(productsResponse.data.map(x => ({
                id: `view:${x._id}`,
                category: x.category,
                inStock: x.inStock,
                name: x.name,
                price: x.price,
                tags: x.tags,
                createdDate: x.createdDate,
                documentType: x.documentType
            })));

        });

        return unsubscribe
    }).create();
    comments = this.collection(commentsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...commentsSchema }).create();
    events = this.collection(eventsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...eventsSchema }).create();
    users = this.collection(usersSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...usersSchema }).create();
    userProfiles = this.collection(userProfileSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...userProfileSchema }).create();
    inventoryItems = this.collection(inventoryItemsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...inventoryItemsSchema }).create();

    players = this.collection(playerSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerSchema }).create();
    playerMatches = this.collection(playerMatchSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerMatchSchema }).create();

    immutableItems = this.collection(immutableItemSchema).readonly().create();

    commentsView = this.view(commentsViewSchema).derive((done) => {
        // defer because we don't want to compute every time we create a datastore
        const unsubscribe = this.comments.defer().subscribe().toArray(response => {

            if (response.ok === "error") {
                return done([]);
            }

            done(response.data.map(x => ({
                content: x.content,
                user: {
                    name: x.author
                },
                createdAt: new Date(),
                replies: x.replies,
                id: `view:${x._id}`
            })))
        });

        return unsubscribe;
    }).create();
}