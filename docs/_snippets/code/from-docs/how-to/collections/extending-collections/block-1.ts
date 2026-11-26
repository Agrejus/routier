import { Collection, DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import type { InferCreateType, InferRoot, InferType } from "@routier/core/schema";

const userSchema = s
    .define("users", {
        id: s.string().key().identity(),
        email: s.string(),
        status: s.string("pending", "active"),
    })
    .compile();

type User = InferType<typeof userSchema>;
type NewUser = InferCreateType<typeof userSchema>;

class UserCollection extends Collection<InferRoot<typeof userSchema>> {
    async findOrCreateByEmailAsync(user: NewUser): Promise<User> {
        const existing = await this.firstOrUndefinedAsync(([u, p]) => u.email === p.email, { email: user.email });

        if (existing != null) {
            return existing;
        }

        const [added] = await this.addAsync(user);
        return added;
    }

    async activatePendingUsersAsync(): Promise<User[]> {
        const pending = await this.where((u) => u.status === "pending").toArrayAsync();

        for (const user of pending) {
            user.status = "active";
        }

        return pending;
    }
}

class AppDataStore extends DataStore {
    users: UserCollection = this.collection(userSchema).proxy().create((_, dependencies) => new UserCollection(dependencies));

    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const ctx = new AppDataStore();

await ctx.users.findOrCreateByEmailAsync({ email: "ada@example.com", status: "pending" });
await ctx.saveChangesAsync();

await ctx.users.activatePendingUsersAsync();
await ctx.saveChangesAsync();
