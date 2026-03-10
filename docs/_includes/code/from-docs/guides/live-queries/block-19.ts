ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    // Handle live updates
  } else {
    console.error("Live query error:", result.error);
    // Fallback to regular query
    ctx.users.toArrayAsync().then((users) => {
      // Handle fallback data
    });
  }
});