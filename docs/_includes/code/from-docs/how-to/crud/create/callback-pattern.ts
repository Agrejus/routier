import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
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

// Adding with callback (discriminated union result pattern)
ctx.users.add([{
    name: "Jane Doe",
    email: "jane@example.com"
}], (result) => {
    if (result.ok === "success") {
        console.log("User created successfully:", result.data);
        // result.data is InferType<typeof userSchema>[]
    } else {
        console.error("Failed to create user:", result.error);
        // result.error contains the error details
    }
});

// Save changes after callback completes
await ctx.saveChangesAsync();
