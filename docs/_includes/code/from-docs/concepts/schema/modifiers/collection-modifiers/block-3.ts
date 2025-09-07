const schema = s.define("users", {
  firstName: s.string(),
  lastName: s.string(),

  // Method is not stored; available at runtime on entity instances
  greet: s.function((user) => `Hello, ${user.firstName}!`),
});