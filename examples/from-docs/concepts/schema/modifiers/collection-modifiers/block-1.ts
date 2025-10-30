const schema = s.define("users", {
  firstName: s.string(),
  lastName: s.string(),
}).modify(w => ({
  // Not persisted by default
  fullName: w.computed((user) => `${user.firstName} ${user.lastName}`),
}));