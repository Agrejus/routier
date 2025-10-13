import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    createdAt: s.date().default(() => new Date()),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Type-safe queries with proper TypeScript integration
type User = InferType<typeof userSchema>;

// ✅ Good - type-safe query functions
async function getUsersByAgeRange(minAge: number, maxAge: number): Promise<User[]> {
    return await ctx.users
        .where((u, p) => u.age >= p.minAge && u.age <= p.maxAge, { minAge, maxAge })
        .toArrayAsync();
}

async function getUserById(id: string): Promise<User | undefined> {
    return await ctx.users.firstOrUndefinedAsync(u => u.id === id);
}

async function getUsersByEmailDomain(domain: string): Promise<User[]> {
    return await ctx.users
        .where(u => u.email.endsWith(`@${domain}`))
        .toArrayAsync();
}

// ✅ Good - type-safe query with proper return types
async function getUserSummary(): Promise<{ total: number; active: number; recent: number }> {
    const [total, active, recent] = await Promise.all([
        ctx.users.countAsync(),
        ctx.users.where(u => u.age >= 18).countAsync(),
        ctx.users.where(u => u.createdAt > new Date("2023-01-01")).countAsync()
    ]);

    return { total, active, recent };
}

// Usage with full type safety
const users = await getUsersByAgeRange(18, 65);
const user = await getUserById("user-123");
const gmailUsers = await getUsersByEmailDomain("gmail.com");
const summary = await getUserSummary();
