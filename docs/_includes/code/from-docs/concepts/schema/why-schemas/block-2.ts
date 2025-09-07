const productSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().min(1).max(100),
  price: s.number().min(0).precision(2),
  category: s.literal("electronics", "clothing", "books"),
  tags: s.array(s.string()).min(1).max(10),
  inStock: s.boolean().default(true),
});

// This will ensure type safety:
// - Name is a string with length constraints
// - Price is a number with precision constraints
// - Category is one of the allowed literal values
// - Tags array has size constraints
// - InStock defaults to true if not provided