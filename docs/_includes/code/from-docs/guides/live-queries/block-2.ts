// Create a live query that updates automatically
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log(result.data); // Live data updates automatically
  }
});

// The query will automatically update when users are added, updated, or removed