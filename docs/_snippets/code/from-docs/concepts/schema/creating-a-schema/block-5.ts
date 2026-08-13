const schema = s.define("orders", {
  // Array with modifiers
  tags: s
    .array(s.string())
    .optional()
    .default(() => []),

  // Object with modifiers
  address: s
    .object({
      street: s.string(),
      city: s.string(),
      zipCode: s.string(),
    })
    .optional(),

  // Nested arrays
  items: s.array(
    s.object({
      productId: s.string(),
      quantity: s.number().min(1),
      price: s.number().min(0),
    })
  ),
});