import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

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
    super(new PouchDbPlugin("myapp"));
  }
}

const ctx = new Ctx();
await ctx.users.addAsync({ name: "Ada", email: "ada@example.com" });
await ctx.saveChangesAsync();

