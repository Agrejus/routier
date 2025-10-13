import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema with nested objects
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    profile: s.object({
        firstName: s.string(),
        lastName: s.string(),
        bio: s.string().optional(),
        avatar: s.string().optional(),
    }),
    preferences: s.object({
        theme: s.string("light", "dark").default("light"),
        notifications: s.boolean().default(true),
    }).default({}),
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

// Creating with nested objects
const newUser = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com",
    profile: {
        firstName: "John",
        lastName: "Doe",
        bio: "Software developer",
        // avatar is optional
    },
    // preferences will use default value {}
});

console.log("Created user:", newUser);
// Output: [{ 
//   id: "generated-uuid",
//   name: "John Doe", 
//   email: "john@example.com",
//   profile: {
//     firstName: "John",
//     lastName: "Doe", 
//     bio: "Software developer",
//     avatar: undefined
//   },
//   preferences: { theme: "light", notifications: true }, // ← Default applied
//   createdAt: Date
// }]

await ctx.saveChangesAsync();
