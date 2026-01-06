import { Bench } from "tinybench";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define test schemas
const userSchema = s
    .define("users", {
        id: s.string().key().identity(),
        email: s.string().distinct(),
        name: s.string(),
        age: s.number(),
        createdAt: s.date().default(() => new Date()),
        status: s.string().default(() => "active"),
    })
    .compile();

const postSchema = s
    .define("posts", {
        id: s.string().key().identity(),
        userId: s.string(),
        title: s.string(),
        content: s.string(),
        views: s.number().default(0),
        publishedAt: s.date().default(() => new Date()),
    })
    .compile();

// Test data generators
function generateUsers(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        age: 20 + (i % 50),
        status: i % 10 === 0 ? "inactive" : "active",
    }));
}

function generatePosts(count: number, userIds: string[]) {
    return Array.from({ length: count }, (_, i) => ({
        userId: userIds[i % userIds.length],
        title: `Post ${i}`,
        content: `Content for post ${i}`.repeat(10),
        views: Math.floor(Math.random() * 1000),
    }));
}

// Create a fresh context for each test
function createContext() {
    class Ctx extends DataStore {
        users = this.collection(userSchema).create();
        posts = this.collection(postSchema).create();
        constructor() {
            super(new MemoryPlugin("benchmark"));
        }
    }
    return new Ctx();
}

// Type guard to check if a task result is successful (has mean property)
function isSuccessfulResult(result: any): result is { mean: number; min: number; max: number; rme?: number; samples?: number[] } {
    return result != null && typeof result.mean === 'number' && typeof result.min === 'number' && typeof result.max === 'number';
}

async function runBenchmarks() {
    const bench = new Bench({
        time: 2000, // Run for at least 2 seconds per task
        iterations: 10, // Minimum iterations
    });

    console.log("🚀 Starting Routier Performance Benchmarks...\n");

    // // ============================================
    // // Schema Operations
    // // ============================================
    // bench.add("Schema - Compile simple schema", () => {
    //     s.define("test", {
    //         id: s.string().key().identity(),
    //         name: s.string(),
    //     }).compile();
    // });

    // bench.add("Schema - Compile complex schema with defaults", () => {
    //     s.define("test", {
    //         id: s.string().key().identity(),
    //         name: s.string(),
    //         email: s.string().distinct(),
    //         age: s.number(),
    //         createdAt: s.date().default(() => new Date()),
    //         status: s.string().default(() => "active"),
    //     }).compile();
    // });

    // // ============================================
    // // Collection Creation
    // // ============================================
    // bench.add("Collection - Create collection", () => {
    //     const ctx = createContext();
    //     // Collection is already created in the class definition
    //     ctx.users;
    // });

    // ============================================
    // Single Record Operations
    // ============================================
    bench.add("CRUD - Add single record", async () => {
        const ctx = createContext();
        console.log("About to add user...");
        console.log("User schema:", userSchema);
        console.log("Context users collection:", ctx.users);
        const userData = { email: "test@example.com", name: "Test", age: 25 };
        console.log("User data:", userData);
        try {
            const result = await ctx.users.addAsync(userData);
            console.log("Add result:", result);
            await ctx.saveChangesAsync();
            console.log("Save completed");
        } catch (error: any) {
            console.error("Error details:", error);
            console.error("Error message:", error?.message);
            console.error("Error stack:", error?.stack);
            throw error;
        }
    });

    // bench.add("CRUD - Add and retrieve single record", async () => {
    //     const ctx = createContext();
    //     await ctx.users.addAsync({ email: "test@example.com", name: "Test", age: 25 });
    //     await ctx.saveChangesAsync();
    //     await ctx.users.where((u) => u.email === "test@example.com").firstAsync();
    // });

    // bench.add("CRUD - Update single record", async () => {
    //     const ctx = createContext();
    //     await ctx.users.addAsync({ email: "test@example.com", name: "Test", age: 25 });
    //     await ctx.saveChangesAsync();
    //     const user = await ctx.users.where((u) => u.email === "test@example.com").firstAsync();
    //     if (user) {
    //         user.name = "Updated";
    //         await ctx.saveChangesAsync();
    //     }
    // });

    // bench.add("CRUD - Delete single record", async () => {
    //     const ctx = createContext();
    //     await ctx.users.addAsync({ email: "test@example.com", name: "Test", age: 25 });
    //     await ctx.saveChangesAsync();
    //     const user = await ctx.users.where((u) => u.email === "test@example.com").firstAsync();
    //     if (user) {
    //         ctx.users.removeAsync(user);
    //         await ctx.saveChangesAsync();
    //     }
    // });

    // // ============================================
    // // Bulk Operations - Small Dataset (100 records)
    // // ============================================
    // bench.add("Bulk - Add 100 records", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(100);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();
    // });

    // bench.add("Bulk - Add 100 records (batch)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(100);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();
    // });

    // bench.add("Bulk - Update 100 records", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(100);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const allUsers = await ctx.users.toArrayAsync();
    //     allUsers.forEach((user) => {
    //         user.age += 1;
    //     });
    //     await ctx.saveChangesAsync();
    // });

    // bench.add("Bulk - Delete 100 records", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(100);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const allUsers = await ctx.users.toArrayAsync();
    //     ctx.users.removeAsync(...allUsers);
    //     await ctx.saveChangesAsync();
    // });

    // // ============================================
    // // Bulk Operations - Medium Dataset (1,000 records)
    // // ============================================
    // bench.add("Bulk - Add 1,000 records", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();
    // });

    // bench.add("Bulk - Add 1,000 records (batch)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();
    // });

    // // ============================================
    // // Bulk Operations - Large Dataset (10,000 records)
    // // ============================================
    // bench.add("Bulk - Add 10,000 records", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(10000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();
    // });

    // bench.add("Bulk - Add 10,000 records (batch)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(10000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();
    // });

    // // ============================================
    // // Query Operations - Filtering
    // // ============================================
    // bench.add("Query - Filter by string (100 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(100);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.where((u) => u.status === "active").toArrayAsync();
    // });

    // bench.add("Query - Filter by number (100 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(100);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.where((u) => u.age > 30).toArrayAsync();
    // });

    // bench.add("Query - Filter by string (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.where((u) => u.status === "active").toArrayAsync();
    // });

    // bench.add("Query - Filter by number (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.where((u) => u.age > 30).toArrayAsync();
    // });

    // bench.add("Query - Complex filter (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users
    //         .where((u) => u.status === "active" && u.age > 30 && u.age < 50)
    //         .toArrayAsync();
    // });

    // // ============================================
    // // Query Operations - Sorting
    // // ============================================
    // bench.add("Query - Sort by string (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const allUsers = await ctx.users.toArrayAsync();
    //     allUsers.sort((a, b) => a.name.localeCompare(b.name));
    // });

    // bench.add("Query - Sort by number (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const allUsers = await ctx.users.toArrayAsync();
    //     allUsers.sort((a, b) => a.age - b.age);
    // });

    // bench.add("Query - Sort descending (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const allUsers = await ctx.users.toArrayAsync();
    //     allUsers.sort((a, b) => b.age - a.age);
    // });

    // bench.add("Query - Sort by multiple fields (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const allUsers = await ctx.users.toArrayAsync();
    //     allUsers.sort((a, b) => {
    //         if (a.status !== b.status) return a.status.localeCompare(b.status);
    //         return a.age - b.age;
    //     });
    // });

    // // ============================================
    // // Query Operations - Pagination
    // // ============================================
    // bench.add("Query - Pagination (skip/take 1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.skip(100).take(50).toArrayAsync();
    // });

    // bench.add("Query - First record (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.firstAsync();
    // });

    // bench.add("Query - Count (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.countAsync();
    // });

    // bench.add("Query - Count with filter (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.where((u) => u.status === "active").countAsync();
    // });

    // // ============================================
    // // Query Operations - Aggregation
    // // ============================================
    // bench.add("Query - Sum (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.sumAsync((u) => u.age);
    // });

    // bench.add("Query - Average (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const allUsers = await ctx.users.toArrayAsync();
    //     const sum = allUsers.reduce((acc, u) => acc + u.age, 0);
    //     const avg = sum / allUsers.length;
    // });

    // bench.add("Query - Min (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.minAsync((u) => u.age);
    // });

    // bench.add("Query - Max (1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     await ctx.users.maxAsync((u) => u.age);
    // });

    // // ============================================
    // // Relationship Queries
    // // ============================================
    // bench.add("Query - Join-like query (1,000 users, 5,000 posts)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const userIds = (await ctx.users.toArrayAsync()).map((u) => u.id);
    //     const posts = generatePosts(5000, userIds);
    //     for (const post of posts) {
    //         await ctx.posts.addAsync(post);
    //     }
    //     await ctx.saveChangesAsync();

    //     // Find all posts for active users
    //     const activeUsers = await ctx.users
    //         .where((u) => u.status === "active")
    //         .toArrayAsync();
    //     const activeUserIds = new Set(activeUsers.map((u) => u.id));

    //     await ctx.posts
    //         .where((p) => activeUserIds.has(p.userId))
    //         .toArrayAsync();
    // });

    // // ============================================
    // // Full Query Chain
    // // ============================================
    // bench.add("Query - Full chain (filter + sort + pagination, 1,000 records)", async () => {
    //     const ctx = createContext();
    //     const users = generateUsers(1000);
    //     for (const user of users) {
    //         await ctx.users.addAsync(user);
    //     }
    //     await ctx.saveChangesAsync();

    //     const filtered = await ctx.users
    //         .where((u) => u.status === "active" && u.age > 25)
    //         .toArrayAsync();
    //     filtered.sort((a, b) => a.age - b.age);
    //     const paginated = filtered.slice(10, 30);
    // });

    // ============================================
    // Run Benchmarks
    // ============================================
    try {
        await bench.run();
    } catch (error) {
        console.error("Error running benchmarks:", error);
    }

    // Check for tasks that failed and log detailed error information
    const failedTasks = bench.tasks.filter(
        (task) => !task.result || !isSuccessfulResult(task.result) || isNaN(task.result.mean)
    );

    if (failedTasks.length > 0) {
        console.log(`\n⚠️  ${failedTasks.length} task(s) did not complete successfully:\n`);
        for (const task of failedTasks) {
            console.log(`  - ${task.name}`);

            // Check for error property
            if ((task as any).error) {
                console.log(`    Error: ${(task as any).error}`);
                if ((task as any).error?.stack) {
                    const stackLines = (task as any).error.stack.split('\n').slice(0, 5);
                    console.log(`    Stack:\n${stackLines.map((l: string) => `      ${l}`).join('\n')}`);
                }
            }

            // Check result status
            if (isSuccessfulResult(task.result)) {
                console.log(`    Result exists but invalid:`, {
                    mean: task.result.mean,
                    min: task.result.min,
                    max: task.result.max,
                    samples: task.result.samples?.length,
                });
            } else {
                console.log(`    No result object - task likely threw an error or timed out`);
            }

            // Try to run the task manually to see the error
            try {
                const fn = (task as any).fn;
                if (fn) {
                    console.log(`    Attempting manual execution...`);
                    await fn();
                    console.log(`    ✓ Manual execution succeeded - likely a timing/iteration issue`);
                }
            } catch (manualError: any) {
                console.log(`    ✗ Manual execution failed: ${manualError.message}`);
                if (manualError.stack) {
                    const stackLines = manualError.stack.split('\n').slice(0, 8);
                    console.log(`    Stack:\n${stackLines.map((l: string) => `      ${l}`).join('\n')}`);
                }
            }
            console.log();
        }
    }

    console.log("\n📊 Benchmark Results:\n");
    console.table(
        bench.tasks.map((task) => {
            const result = isSuccessfulResult(task.result) ? task.result : null;
            return {
                Name: task.name,
                "Avg (ms)": result ? (result.mean * 1000).toFixed(3) : "N/A",
                "Min (ms)": result ? (result.min * 1000).toFixed(3) : "N/A",
                "Max (ms)": result ? (result.max * 1000).toFixed(3) : "N/A",
                "RME (%)": result && result.rme ? result.rme.toFixed(2) : "N/A",
                "Samples": result && result.samples ? result.samples.length : 0,
                "Ops/sec": result
                    ? Math.round(1 / result.mean)
                    : 0,
            };
        })
    );

    // Summary statistics - filter out tasks with no results or invalid results
    const results = bench.tasks
        .filter((task) => {
            const result = task.result;
            return isSuccessfulResult(result) && !isNaN(result.mean) && isFinite(result.mean);
        })
        .map((task) => {
            const result = task.result!;
            return {
                name: task.name,
                mean: isSuccessfulResult(result) ? result.mean : 0,
            };
        })
        .sort((a, b) => a.mean - b.mean);

    if (results.length > 0) {
        console.log("\n🏆 Fastest Operations:\n");
        results.slice(0, Math.min(5, results.length)).forEach((result, i) => {
            const meanMs = result.mean * 1000;
            if (isFinite(meanMs) && !isNaN(meanMs)) {
                console.log(
                    `${i + 1}. ${result.name}: ${meanMs.toFixed(3)}ms`
                );
            }
        });

        console.log("\n🐌 Slowest Operations:\n");
        results.slice(-Math.min(5, results.length)).reverse().forEach((result, i) => {
            const meanMs = result.mean * 1000;
            if (isFinite(meanMs) && !isNaN(meanMs)) {
                console.log(
                    `${i + 1}. ${result.name}: ${meanMs.toFixed(3)}ms`
                );
            }
        });
    } else {
        console.log("\n⚠️  No valid benchmark results to display.");
    }
}

// Run the benchmarks
runBenchmarks().catch(console.error);
