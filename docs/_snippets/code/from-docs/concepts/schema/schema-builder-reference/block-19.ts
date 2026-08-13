const orderSchema = s
  .define("orders", {
    // Primary key
    id: s.string().key().identity(),

    // User reference
    userId: s.string().index("user_date"),

    // Order details
    items: s.array(
      s.object({
        productId: s.string(),
        quantity: s.number(),
        price: s.number(),
        total: s.number().computed((item) => item.quantity * item.price),
      })
    ),

    // Shipping information
    shipping: s.object({
      address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zipCode: s.string(),
        country: s.string(),
      }),
      method: s.string<"standard" | "express" | "overnight">(),
      cost: s.number(),
    }),

    // Order metadata
    status: s.string<"pending" | "processing" | "shipped" | "delivered">(),
    createdAt: s
      .date()
      .default(() => new Date())
      .index("user_date"),
    updatedAt: s.date().default(() => new Date()),

    // Computed fields
    totalItems: s
      .number()
      .computed((order) =>
        order.items.reduce((sum, item) => sum + item.quantity, 0)
      ),
    totalAmount: s
      .number()
      .computed(
        (order) =>
          order.items.reduce((sum, item) => sum + item.total, 0) +
          order.shipping.cost
      ),
  })
  .compile();