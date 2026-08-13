// Using callback-based API with result pattern
ctx.users.add(
  {
    name: "Alice Brown",
    email: "alice@example.com",
    age: 28,
  },
  (result) => {
    if (result.ok === "error") {
      console.error("Failed to add user:", result.error);
      return;
    }
    console.log("User added:", result.data);
  }
);