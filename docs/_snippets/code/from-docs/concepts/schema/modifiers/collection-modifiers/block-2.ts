const schema = s.define("orders", {
  items: s.array(
    s.object({
      productId: s.string(),
      quantity: s.number(),
      price: s.number(),
    })
  ),
}).modify(w => ({
  // Persisted computed field - tracked for faster reads
  total: w.computed((order) =>
    order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  ).tracked(),
}));