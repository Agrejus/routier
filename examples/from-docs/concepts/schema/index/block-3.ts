const orderSchema = s
  .define("orders", {
    id: s.string().key().identity(),
    userId: s.string().index("user_date"),
    items: s.array(
      s.object({
        productId: s.string(),
        quantity: s.number(),
        price: s.number(),
      })
    ),
    shipping: s.object({
      address: s.object({
        street: s.string(),
        city: s.string(),
        zipCode: s.string(),
      }),
      method: s.string<"standard" | "express">(),
    }),
    status: s.string<"pending" | "processing" | "shipped">(),
    createdAt: s
      .date()
      .default(() => new Date())
      .index("user_date"),
  })
  .compile();