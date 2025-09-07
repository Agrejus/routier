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

// Simple filter
const james = await ctx.users.where((u) => u.name === "James").toArrayAsync();

// Parameterized filter
const withPrefix = await ctx.users
  .where(([u, p]) => u.name.startsWith(p.prefix), { prefix: "Ja" })
  .toArrayAsync();