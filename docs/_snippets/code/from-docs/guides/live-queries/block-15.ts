// Good: Use live queries for data that changes frequently
ctx.messages.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log("Messages:", result.data);
  }
});

// Less useful: Static data doesn't need live queries
const staticConfig = await ctx.config.toArrayAsync();