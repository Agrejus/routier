const schema = s.define("users", {
  // Custom serialization
  date: s
    .date()
    .default(() => new Date())
    .deserialize((str) => new Date(str))
    .serialize((date) => date.toISOString()),

  // Custom transformation
  fullName: s
    .string()
    .deserialize((str) => str.trim())
    .serialize((str) => str.toLowerCase()),
});