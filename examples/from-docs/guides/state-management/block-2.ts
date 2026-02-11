ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log("Users:", result.data); // Automatically updates when users change
  }
});