const schema = s.define("users", {
  // Basic array
  tags: s.array(s.string()),

  // Array with modifiers
  scores: s.array(s.number()).default(() => []),
  phoneNumbers: s.array(s.string()).optional(),

  // Array of objects
  orders: s.array(
    s.object({
      productId: s.string(),
      quantity: s.number(),
      price: s.number(),
    })
  ),

  // Nested arrays
  matrix: s.array(s.array(s.number())),
});