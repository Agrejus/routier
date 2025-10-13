import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a post schema with default values
const postSchema = s.define("posts", {
    id: s.string().key().identity(),
    title: s.string(),
    content: s.string(),
    status: s.string("draft", "published", "archived").default("draft"),
    views: s.number().default(0),
    publishedAt: s.date().optional(),
    createdAt: s.date().default(() => new Date()),
    updatedAt: s.date().default(() => new Date()),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    posts = this.collection(postSchema).create();
}

const ctx = new AppContext();

// Creating with minimal data - defaults are applied automatically
const newPost = await ctx.posts.addAsync({
    title: "My First Post",
    content: "This is the content of my first post."
});

console.log("Created post:", newPost);
// Output: [{ 
//   id: "generated-uuid", 
//   title: "My First Post", 
//   content: "This is the content of my first post.",
//   status: "draft",        // ← Default applied
//   views: 0,              // ← Default applied  
//   publishedAt: undefined, // ← Optional field
//   createdAt: Date,       // ← Default applied
//   updatedAt: Date        // ← Default applied
// }]

await ctx.saveChangesAsync();
