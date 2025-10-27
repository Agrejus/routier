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

// Ascending
const byName = await ctx.users.sort((u) => u.name).toArrayAsync();

// Descending
const newest = await ctx.users
  .sortDescending((u) => u.createdAt)
  .toArrayAsync();

// Multi-sort (applies in order added)
const sorted = await ctx.users
  .sort((u) => u.lastName)
  .sort((u) => u.firstName)
  .toArrayAsync();