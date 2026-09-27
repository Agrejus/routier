import { InferType, s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

export const userSchema = s
    .define("users", {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

export const postSchema = s
    .define("posts", {
        id: s.string().key().identity(),
        authorId: s.string().foreignKey(userSchema, "id"),
        title: s.string(),
    })
    .compile();

export type User = InferType<typeof userSchema>;
export type Post = InferType<typeof postSchema>;

export class BlogStore extends DataStore {
    users = this.collection(userSchema).proxy().create();
    posts = this.collection(postSchema).proxy().create();

    constructor() {
        super(new MemoryPlugin("blog"));
    }
}

export const store = new BlogStore();
