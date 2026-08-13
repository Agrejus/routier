// Clear, readable data definition
const orderSchema = s.object({
  id: s.string().key().identity(),
  customerId: s.string().key(),
  items: s
    .array(
      s.object({
        productId: s.string().key(),
        quantity: s.number().min(1),
        unitPrice: s.number().min(0),
        totalPrice: s
          .number()
          .computed((item) => item.quantity * item.unitPrice),
      })
    )
    .min(1),
  status: s.literal("pending", "confirmed", "shipped", "delivered"),
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().tracked(),
  totalAmount: s
    .number()
    .computed((order) =>
      order.items.reduce((sum, item) => sum + item.totalPrice, 0)
    ),
});

// Anyone reading this code immediately understands:
// - What an order contains
// - What fields are required vs optional
// - What values are allowed for each field
// - How computed fields work