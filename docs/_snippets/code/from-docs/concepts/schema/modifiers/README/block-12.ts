const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string(),

  // Convert single string to array of strings
  tags: s.string().array(),

  // Convert single number to array of numbers
  scores: s.number().array(),

  // Convert object to array of objects
  addresses: s
    .object({
      street: s.string(),
      city: s.string(),
    })
    .array(),
});