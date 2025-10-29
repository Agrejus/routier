import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    name: s.string(),
    status: s.string("active", "inactive", "pending").default("pending"),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

class AppDataStore extends DataStore {
  users = this.collection(userSchema).create((Instance, ...args) => {
    return new (class extends Instance {
      constructor() {
        super(...args);
      }

      // Add a method that finds a user by email or creates one
      async findOrCreateByEmailAsync(email: string, name: string) {
        const existing = await this.firstOrUndefinedAsync((u) => u.email === email);
        if (existing) {
          return existing;
        }
        return this.addAsync({ email, name });
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

// Use the custom method - finds existing user or creates new one
await ctx.users.findOrCreateByEmailAsync("user@example.com", "User Name");

// Use the activation helper
await ctx.users.activatePendingUsersAsync();

// All base methods still work
const allUsers = await ctx.users.toArrayAsync();
await ctx.saveChangesAsync();