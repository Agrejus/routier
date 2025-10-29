import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    name: s.string(),
    status: s.string("active", "inactive", "pending"),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

class AppDataStore extends DataStore {
  users = this.collection(userSchema).create((Instance, ...args) => {
    return new (class extends Instance {
      constructor() {
        super(...args);
      }

      // Add a helper method that sets defaults
      async addWithDefaultsAsync(email: string, name: string) {
        return this.addAsync({
          email,
          name,
          status: "pending", // Default status
          createdAt: new Date(),
        });
      }

      // Add a method that combines query and update
      async activatePendingUsersAsync() {
        const pending = await this.where((u) => u.status === "pending").toArrayAsync();
        pending.forEach((user) => {
          user.status = "active";
        });
        return pending;
      }
    })();
  });

  constructor() {
    super(new MemoryPlugin("app"));
  }
}

const ctx = new AppDataStore();

// Use the custom method
await ctx.users.addWithDefaultsAsync("user@example.com", "User Name");

// Use the activation helper
await ctx.users.activatePendingUsersAsync();

// All base methods still work
const allUsers = await ctx.users.toArrayAsync();
await ctx.saveChangesAsync();