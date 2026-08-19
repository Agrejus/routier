import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { InferType, s } from "@routier/core/schema";

// Define a schema
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
  })
  .compile();

// Create a context (datastore) using the plugin
class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("routier-app"));
  }
  users = this.collection(userSchema).proxy().create();
}

const ctx = new AppContext();
await ctx.users.addAsync({ name: "James", email: "james@example.com" });
await ctx.saveChangesAsync();

// Select it back. Types flow from the schema, so `found.email` is checked with no annotation.
const found = await ctx.users.firstOrUndefinedAsync(
  ([u, p]) => u.name === p.name,
  { name: "James" }
);

console.log(found?.email); // james@example.com

// You rarely need to name the entity type — but when you do (a function parameter, a React
// prop, an API payload), read it off the schema with InferType rather than hand-writing an
// interface that can drift from it.
type User = InferType<typeof userSchema>;

const greet = (person: User) => `${person.name} <${person.email}>`;

const user: User | undefined = found;

if (user != null) {
  console.log(greet(user)); // James <james@example.com>
}
