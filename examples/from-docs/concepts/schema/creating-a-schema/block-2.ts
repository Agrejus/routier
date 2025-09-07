const schema = s.define("products", {
  status: s.string<"draft" | "published" | "archived">(),
  priority: s.number<1 | 2 | 3 | 4 | 5>(),
  type: s.boolean<true>(), // Only true allowed
});