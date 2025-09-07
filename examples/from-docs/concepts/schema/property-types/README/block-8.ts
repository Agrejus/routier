const schema = s.define("orders", {
  // Single literal value
  maxItems: s.number<10>(),

  // Multiple literal values
  status: s.number<0 | 1 | 2>(), // 0=pending, 1=processing, 2=completed

  // With modifiers
  priority: s.number<1 | 2 | 3 | 4 | 5>().default(3),
});