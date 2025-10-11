import { s, InferCreateType } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

// Define once, use everywhere
const userSchema = s.define("users", {
  id: s.string().key().identity(),
  email: s.string(),
  name: s.string(),
}).compile();

// In your data store
class AppDataStore extends DataStore {
  constructor() {
    super(new MemoryPlugin("app"));
  }

  users = this.collection(userSchema).create();
}

const dataStore = new AppDataStore();

// In your API layer - TypeScript provides compile-time validation
app.post("/users", (req, res) => {
  // TypeScript ensures the data structure matches the schema
  const userData: InferCreateType<typeof userSchema> = req.body;

  // Add user to collection
  dataStore.users.addAsync(userData);
  dataStore.saveChangesAsync();
});

// In your frontend
const createUser = async (userData: InferCreateType<typeof userSchema>) => {
  // TypeScript ensures userData matches the schema
  const response = await fetch("/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
};