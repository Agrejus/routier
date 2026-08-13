// Good: Filter before subscribing to reduce tracked changes
ctx.users
  .where((u) => u.isActive === true)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      // Handle active users
    }
  });

// Less efficient: Subscribe to all data, then filter in component
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    const activeUsers = result.data.filter((u) => u.isActive);
    // Handle filtered results
  }
});