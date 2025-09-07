// Save all pending changes
const result = await ctx.saveChangesAsync();
console.log("Changes saved:", result);

// Using callback-based API with result pattern
ctx.saveChanges((result) => {
  if (result.ok === "error") {
    console.error("Failed to save changes:", result.error);
    return;
  }
  console.log("Changes saved successfully:", result.data);
});