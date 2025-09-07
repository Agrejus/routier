// ✅ Good - meaningful defaults
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    inStock: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
    status: s.string<"draft" | "published" | "archived">().default("draft"),
  })
  .compile();

// ❌ Avoid - confusing defaults
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    inStock: s.boolean().default(false), // Most products should be in stock
    status: s.string().default("unknown"), // Vague default
  })
  .compile();