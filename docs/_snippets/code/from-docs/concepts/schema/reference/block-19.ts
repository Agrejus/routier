const schema = s
  .define("user", {
    firstName: s.string(),
    lastName: s.string(),
  })
  .modify((w) => ({
    fullName: w.computed((user) => `${user.firstName} ${user.lastName}`),
    documentType: w.computed((_, t) => t).tracked(),
    greet: w.function(
      (user) => (greeting) => `${greeting}, ${user.firstName}!`
    ),
  }))
  .compile();