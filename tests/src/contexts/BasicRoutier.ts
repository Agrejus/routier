import { Routier } from 'routier';
import { user } from '../schemas/user';
import { product } from '../schemas/product';
import { inventoryItem } from '../schemas/inventoryItem';
import { event } from '../schemas/event';
import { order } from '../schemas/order';
import { blogPost } from '../schemas/blogPost';
import { comment } from '../schemas/comments';
import { IDbPlugin } from 'routier-core';

export class BasicRoutier extends Routier {

    get pluginName() {
        return this.dbPlugin.constructor.name
    }

    // need to use stateful collections too
    users = this.collection(user).create();
    products = this.collection(product).create();
    inventoryItems = this.collection(inventoryItem).create();
    events = this.collection(event).create();
    orders = this.collection(order).create();
    blogPosts = this.collection(blogPost).create();
    comments = this.collection(comment).create();

    static create(plugin: IDbPlugin) {
        return new BasicRoutier(plugin);
    }

    async [Symbol.asyncDispose]() {
        await this.destroyAsync();
    }
} 