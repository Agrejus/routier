import { DataStore } from "routier";
import { s } from "routier-core/schema";
import { MemoryPlugin } from "routier-plugin-memory";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    name: s.string(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

class Ctx extends DataStore {
  users = this.collection(userSchema).create();
  constructor() {
    super(new MemoryPlugin("app"));
  }
}

const ctx = new Ctx();
await ctx.users.addAsync({ name: "Ada", email: "ada@example.com" });
await ctx.saveChangesAsync();