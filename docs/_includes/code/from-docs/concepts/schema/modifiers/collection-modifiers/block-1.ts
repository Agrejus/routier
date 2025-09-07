const schema = s.define("users", {
  firstName: s.string(),
  lastName: s.string(),

  // Not persisted by default
  fullName: s.string().computed((user) => `${user.firstName} ${user.lastName}`),
});