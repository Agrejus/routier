// Live single item query
ctx.users
  .sort((u) => u.createdAt)
  .subscribe()
  .firstOrUndefined((result) => {
    if (result.ok === "success") {
      console.log("First user:", result.data);
    }
  });

// This will update when the first user changes