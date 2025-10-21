import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    isActive: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Removing with callbacks (discriminated union result pattern)
const user = await ctx.users.firstAsync();

ctx.users.remove([user], (result) => {
    if (result.ok === "success") {
        console.log("User removed successfully:", result.data);
        // result.data is InferType<typeof userSchema>[]
    } else {
        console.error("Failed to remove user:", result.error);
        // result.error contains the error details
    }
});

// Save changes after callback completes
await ctx.saveChangesAsync();
