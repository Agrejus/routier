import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define schemas for cascading deletion
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    createdAt: s.date().default(() => new Date()),
}).compile();

const postSchema = s.define("posts", {
    id: s.string().key().identity(),
    title: s.string(),
    content: s.string(),
    userId: s.string(), // Foreign key to users
    createdAt: s.date().default(() => new Date()),
}).compile();

// Create DataStore with collections
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
    posts = this.collection(postSchema).create();
}

const ctx = new AppContext();

// Cascading deletion - remove related data
async function deleteUserWithPosts(userId: string) {
    // First, get the user
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        console.log("User not found");
        return;
    }

    // Get all posts by this user
    const userPosts = await ctx.posts.where(p => p.userId === userId).toArrayAsync();
    console.log(`Found ${userPosts.length} posts by user ${user.name}`);

    // Remove all posts first (cascading deletion)
    if (userPosts.length > 0) {
        await ctx.posts.removeAsync(...userPosts);
        console.log("Removed all user posts");
    }

    // Then remove the user
    await ctx.users.removeAsync(user);
    console.log("Removed user");

    // Save all changes
    await ctx.saveChangesAsync();
    console.log("Cascading deletion completed");
}

// Usage
await deleteUserWithPosts("user-123");
