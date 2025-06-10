import { Routier } from 'routier';
// import { MemoryPlugin } from 'routier-plugin-memory';
import { user } from '../schemas/user';
import { product } from '../schemas/product';
import { inventoryItem } from '../schemas/inventoryItem';
import { event } from '../schemas/event';
import { order } from '../schemas/order';
import { blogPost } from '../schemas/blogPost';
import { comment } from '../schemas/comments';
import { uuidv4 } from 'routier-core';
import { PouchDbPlugin } from 'routier-plugin-pouchdb';

export class BasicRoutier extends Routier {
    constructor(dbname: string) {
        //super(new MemoryPlugin(dbname))
        super(new PouchDbPlugin(dbname));
    }

    // need to use stateful collections too
    users = this.collection(user).create();
    products = this.collection(product).create();
    inventoryItems = this.collection(inventoryItem).create();
    events = this.collection(event).create();
    orders = this.collection(order).create();
    blogPosts = this.collection(blogPost).create();
    comments = this.collection(comment).create();

    static create() {
        return new BasicRoutier(uuidv4());
    }

    async [Symbol.asyncDispose]() {
        await this.destroyAsync();
    }
} 