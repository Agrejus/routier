const orderSchema = s
  .define("orders", {
    id: s.string().key().identity(),
    customer: s.object({
      name: s.string(),
      email: s.string(),
      address: s.object({
        street: s.string(),
        city: s.string(),
        zipCode: s.string(),
      }),
    }),
    items: s.array(
      s.object({
        productId: s.string(),
        quantity: s.number(),
        price: s.number(),
      })
    ),
  })
  .compile();

const newOrder = await ctx.orders.addAsync({
  customer: {
    name: "John Doe",
    email: "john@example.com",
    address: {
      street: "123 Main St",
      city: "Anytown",
      zipCode: "12345",
    },
  },
  items: [
    {
      productId: "prod-123",
      quantity: 2,
      price: 29.99,
    },
  ],
});

console.log(newOrder.customer.address.city); // "Anytown"