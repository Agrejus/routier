// Save all pending changes
const result = await ctx.saveChangesAsync();
console.log("Changes saved:", result);

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

// Using callback-based API with result pattern
ctx.saveChanges((result) => {
  if (result.ok === "error") {
    console.error("Failed to save changes:", result.error);
    return;
  }
  console.log("Changes saved successfully:", result.data);
});