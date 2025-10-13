import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a post schema with computed fields
const postSchema = s.define("posts", {
    id: s.string().key().identity(),
    title: s.string(),
    content: s.string(),
    author: s.string(),
    publishedAt: s.date().optional(),
}).modify(w => ({
    // Computed field - automatically calculated
    slug: w.computed((entity) =>
        entity.title.toLowerCase().replace(/\s+/g, '-')
    ).tracked(),

    // Function field - non-persisted method
    isPublished: w.function((entity) => entity.publishedAt != null),
})).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    posts = this.collection(postSchema).create();
}

const ctx = new AppContext();

// Creating with computed fields
const newPost = await ctx.posts.addAsync({
    title: "My First Post",
    content: "This is the content of my first post.",
    author: "John Doe"
});

console.log("Created post:", newPost);
// Output: [{ 
//   id: "generated-uuid",
//   title: "My First Post",
//   content: "This is the content of my first post.",
//   author: "John Doe",
//   publishedAt: undefined,
//   slug: "my-first-post",  // ← Computed field
//   isPublished: function   // ← Function field
// }]

// Access computed and function fields
const post = newPost[0];
console.log("Slug:", post.slug); // "my-first-post"
console.log("Is published:", post.isPublished()); // false

await ctx.saveChangesAsync();
