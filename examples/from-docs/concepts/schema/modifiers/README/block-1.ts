const schema = s.define("orders", {
  // Derived, not persisted by default
  total: s
    .number()
    .computed((order) =>
      order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    ),

  // Persist the computed value to the data store
  totalCached: s
    .number()
    .computed((order) =>
      order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    )
    .tracked()
    .index(),
});