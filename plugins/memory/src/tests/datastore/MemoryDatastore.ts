import { fastHash, HashType, IDbPlugin } from "@routier/core";
import { DataStore } from "@routier/datastore";
import { productsSchema } from "../schemas/product";
import { commentsSchema, CreateComment } from "../schemas/comments";
import { eventsSchema } from "../schemas/event";
import { usersSchema } from "../schemas/user";
import { userProfileSchema } from "../schemas/userProfile";
import { inventoryItemsSchema } from "../schemas/inventoryItem";
import { playerSchema } from "../schemas/player";
import { playerMatchSchema } from "../schemas/playerMatch";
import { immutableItemSchema } from "../schemas/immutableItem";
import { commentsViewSchema } from "../schemas/commentsView";
import { productsViewSchema } from "../schemas/productView";
import { productsHistorySchema } from "../schemas/productsHistory";
import { ordersSchema } from "../schemas/order";
import { blogPostsSchema } from "../schemas/blogPost";
import { taskViewSchema } from "../schemas/taskView";
import { taskSchema } from "../schemas/task";

export class TestDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(productsSchema).scope(([x, p]) => x.documentType === p.collectionName, productsSchema).create();
    productsView = this.view(productsViewSchema).scope(([x, p]) => x.documentType === p.collectionName, productsViewSchema).derive((done) => {
        return this.products.subscribe().toArray(productsResponse => {

            if (productsResponse.ok === "error") {
                return done([]);// do nothing
            }

            done(productsResponse.data.map(x => ({
                id: `view:${x._id}`, // Must have a predictable Id to reference for updates, otherwise everything will be an insert
                category: x.category,
                inStock: x.inStock,
                name: x.name,
                price: x.price,
                tags: x.tags,
                createdDate: x.createdDate,
                documentType: productsViewSchema.collectionName
            })));

        });
    }).create();
    productsHistory = this.view(productsHistorySchema).scope(([x, p]) => x.documentType === p.collectionName, productsHistorySchema).derive((done) => {
        return this.products.subscribe().toArray(productsResponse => {

            if (productsResponse.ok === "error") {
                return done([]); // do nothing
            }

            // Id is computed inside of derive as part of the pre-save process as defined by the schema
            done(productsResponse.data.map(x => ({
                productId: x._id,
                category: x.category,
                inStock: x.inStock,
                name: x.name,
                price: x.price,
                tags: x.tags,
                createdDate: x.createdDate,
                documentType: productsHistorySchema.collectionName
            })));

        });
    }).create();
    comments = this.collection(commentsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...commentsSchema }).create();
    events = this.collection(eventsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...eventsSchema }).create();
    users = this.collection(usersSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...usersSchema }).create();
    userProfiles = this.collection(userProfileSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...userProfileSchema }).create();
    inventoryItems = this.collection(inventoryItemsSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...inventoryItemsSchema }).create();

    players = this.collection(playerSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerSchema }).create();
    playerMatches = this.collection(playerMatchSchema).scope(([x, p]) => x.documentType === p.collectionName, { ...playerMatchSchema }).create();

    immutableItems = this.collection(immutableItemSchema).readonly().create();
    orders = this.collection(ordersSchema).create();

    commentsView = this.view(commentsViewSchema).derive((done) => {
        // defer because we don't want to compute every time we create a datastore
        const unsubscribe = this.comments.subscribe().toArray(response => {

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
    blogPosts = this.collection(blogPostsSchema).create();

    tasks = this.collection(taskSchema).create();
    highPriorityTasksView = this.view(taskViewSchema)
        .derive((done) => {
            return this.tasks.subscribe().toArray((response) => {
                if (response.ok === "error") {
                    return done([]);
                }

                // Filter and transform high priority tasks
                done(
                    response.data
                        .filter((x) => x.priority === "high" || x.priority === "urgent")
                        .map((x) => ({
                            id: `view:${x.id}`, // Predictable ID for one-to-one mapping
                            title: x.title,
                            description: x.description,
                            priority: x.priority,
                            status: x.status,
                            assignee: x.assignee,
                            originalTaskId: x.id,
                            createdAt: x.createdAt,
                        }))
                );
            });
        })
        .create();
}