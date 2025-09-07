const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string<"electronics" | "clothing" | "books">(),
    inStock: s.boolean().default(true),
  })
  .compile();