**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

// Using callback-based API with result pattern
const userToRemove = await ctx.users.firstOrUndefinedAsync(
  (u) => u.id === "user-123"
);

if (userToRemove) {
  ctx.users.remove([userToRemove], (result) => {
    if (result.ok === "error") {
      console.error("Failed to remove user:", result.error);
      return;
    }
    console.log("User removed successfully:", result.data);
  });
}