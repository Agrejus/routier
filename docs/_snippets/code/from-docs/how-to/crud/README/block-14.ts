// Using callback-based API for updates
ctx.users.first(
  (user) => user.name === "John Doe",
  (result) => {
    if (result.ok === "error") {
      console.error("Failed to find user:", result.error);
      return;
    }

    const user = result.data;
    if (user) {
      user.name = "John Smith";
      user.age = 31;
    }
  }
);