// ✅ Correct: Use callbacks with .subscribe()
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log(result.data);
  }
});

// ❌ Incorrect: Cannot use async methods with .subscribe()
// This will NOT work:
const data = await ctx.users.subscribe().toArrayAsync();