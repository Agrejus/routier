// User action → Write to Dexie (slow, but doesn't block UI)
await ctx.vehicles.addAsync({ make: "Tesla", model: "Model 3" });
await ctx.saveChangesAsync();

// UI continues to be responsive because reads are from memory
const vehicles = await ctx.vehicles.toArrayAsync(); // Instant!