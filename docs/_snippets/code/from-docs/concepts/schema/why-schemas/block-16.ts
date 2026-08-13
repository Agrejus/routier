// Instead of computing in queries
const fullName = s
  .string()
  .computed((user) => `${user.firstName} ${user.lastName}`);

// Avoid computing in application code
// const fullName = `${user.firstName} ${user.lastName}`;