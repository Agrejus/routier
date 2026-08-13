const productSchema = s
  .define("products", {
    // Primary key
    id: s.string().key().identity(),

    // Basic fields
    name: s.string(),
    description: s.string().optional(),
    price: s.number(),

    // Constrained fields
    status: s.string<"draft" | "published" | "archived">(),
    category: s.string<"electronics" | "clothing" | "books">(),
    priority: s.number<1 | 2 | 3 | 4 | 5>().default(3),

    // Object fields
    metadata: s
      .object({
        source: s.string(),
        version: s.string(),
        tags: s.array(s.string()).default(() => []),
      })
      .optional(),

    // Array fields
    images: s.array(s.string()).default(() => []),
    variants: s
      .array(
        s.object({
          color: s.string(),
          size: s.string(),
          stock: s.number().default(0),
        })
      )
      .default(() => []),

    // Indexed fields
    name: s.string().index("name_category"),
    category: s.string().index("name_category"),
    price: s.number().index("price_range"),
  })
  .compile();