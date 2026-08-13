// Example: Adding with callback
ctx.users.add({ name: "John Doe", email: "john@example.com" }, (result) => {
  if (result.ok === "error") {
    console.error("Failed to add user:", result.error);
    return;
  }
  console.log("User added:", result.data);
});

// Example: Querying with callback
ctx.users.first(
  (user) => user.email === "john@example.com",
  (result) => {
    if (result.ok === "error") {
      console.error("Query failed:", result.error);
      return;
    }
    const user = result.data;
    if (user) {
      console.log("Found user:", user.name);
    }
  }
);