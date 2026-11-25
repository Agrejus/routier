import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import type { InferType } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

const postSchema = s.define("posts", {
    id: s.string().key().identity(),
    title: s.string(),
    createdAt: s.date().default(() => new Date()),
}).compile();

type Post = InferType<typeof postSchema>;

class AppDataStore extends DataStore {
    posts = this.collection(postSchema).proxy().create();

    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const dataStore = new AppDataStore();

const loadPage = (lastRow: Post | null) => dataStore.posts
    .sortDescending(post => post.createdAt)
    .cursor(lastRow)
    .take(20)
    .toArrayAsync();

const firstPage = await loadPage(null);
const secondPage = await loadPage(firstPage[firstPage.length - 1] ?? null);
