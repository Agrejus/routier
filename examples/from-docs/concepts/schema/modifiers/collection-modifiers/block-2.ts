const schema = s.define("orders", {
  items: s.array(s.object({ price: s.number(), quantity: s.number() })),

  // Persisted computed field
  total: s
    .number()
    .computed((order) =>
      order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    )
    .tracked()
    .index(),
});