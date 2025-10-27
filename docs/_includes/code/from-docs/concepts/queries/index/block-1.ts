import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

const userSchema = s
    .define("user", {
        id: s.string().key().identity(),
        name: s.string(),
        email: s.string(),
    })
    .compile();

class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("my-app"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// All items
const all = await ctx.users.toArrayAsync();

// First item or undefined
const first = await ctx.users.firstOrUndefinedAsync();

// Does any record exist?
const hasAny = await ctx.users.someAsync();