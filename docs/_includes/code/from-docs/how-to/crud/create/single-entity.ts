import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number().optional(),
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

// Adding a single entity
const newUser = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com",
    age: 30
});

console.log("Created user:", newUser);
// Output: [{ id: "generated-uuid", name: "John Doe", email: "john@example.com", age: 30, createdAt: Date }]

// Don't forget to save changes!
await ctx.saveChangesAsync();
