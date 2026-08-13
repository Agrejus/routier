const schema = s.define("users", {
  // Convert string to array of strings
  singleTag: s.string().array(),

  // Convert number to array of numbers
  singleScore: s.number().array(),

  // Convert object to array of objects
  singleAddress: s
    .object({
      street: s.string(),
      city: s.string(),
    })
    .array(),

  // Convert boolean to array of booleans
  singleFlag: s.boolean().array(),
});