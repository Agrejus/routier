// Get first user matching criteria
const user = await ctx.users.firstOrUndefinedAsync(
  (u) => u.email === "john@example.com"
);
if (user) {
  console.log("Found user:", user.name);
}

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

// Get first user with callback API
ctx.users.first(
  (u) => u.email === "john@example.com",
  (result) => {
    if (result.ok === "error") {
      console.error("Query failed:", result.error);
      return;
    }
    const user = result.data;
    if (user) {
      console.log("Found user:", user.name);
    }
  }
);