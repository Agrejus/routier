import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define schemas for related data
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

const commentSchema = s.define("comments", {
    id: s.string().key().identity(),
    content: s.string(),
    postId: s.string(), // Foreign key to posts
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
    comments = this.collection(commentSchema).create();
}

const ctx = new AppContext();

// Handle related data appropriately
async function deleteUserWithRelatedData(userId: string) {
    // Get the user
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        console.log("User not found");
        return false;
    }

    // Get related data
    const userPosts = await ctx.posts.where(p => p.userId === userId).toArrayAsync();
    const userComments = await ctx.comments.where(c => c.userId === userId).toArrayAsync();

    console.log(`Found ${userPosts.length} posts and ${userComments.length} comments by user ${user.name}`);

    // Handle related data based on business rules

    // Option 1: Cascading deletion (delete related data)
    if (userPosts.length > 0) {
        // Delete comments on user's posts first
        for (const post of userPosts) {
            const postComments = await ctx.comments.where(c => c.postId === post.id).toArrayAsync();
            if (postComments.length > 0) {
                await ctx.comments.removeAsync(...postComments);
                console.log(`Deleted ${postComments.length} comments on post: ${post.title}`);
            }
        }

        // Delete user's posts
        await ctx.posts.removeAsync(...userPosts);
        console.log(`Deleted ${userPosts.length} posts by user`);
    }

    // Delete user's comments on other posts
    if (userComments.length > 0) {
        await ctx.comments.removeAsync(...userComments);
        console.log(`Deleted ${userComments.length} comments by user`);
    }

    // Finally, delete the user
    await ctx.users.removeAsync(user);
    console.log("Deleted user");

    // Save all changes
    await ctx.saveChangesAsync();
    console.log("User and related data deleted successfully");

    return true;
}

// Option 2: Orphan related data (set foreign keys to null)
async function deleteUserOrphanRelatedData(userId: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        console.log("User not found");
        return false;
    }

    // Update posts to remove user reference (orphan the posts)
    const userPosts = await ctx.posts.where(p => p.userId === userId).toArrayAsync();
    userPosts.forEach(post => {
        post.userId = ""; // Or set to a default "deleted" user ID
    });

    // Update comments to remove user reference
    const userComments = await ctx.comments.where(c => c.userId === userId).toArrayAsync();
    userComments.forEach(comment => {
        comment.userId = ""; // Or set to a default "deleted" user ID
    });

    // Delete the user
    await ctx.users.removeAsync(user);

    await ctx.saveChangesAsync();
    console.log("User deleted, related data orphaned");

    return true;
}

// Usage
await deleteUserWithRelatedData("user-123");
