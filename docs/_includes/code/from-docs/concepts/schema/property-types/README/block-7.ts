const schema = s.define("products", {
  // Single literal value
  type: s.string<"physical">(),

  // Multiple literal values
  status: s.string<"draft" | "published" | "archived">(),
  category: s.string<"electronics" | "clothing" | "books">(),

  // With modifiers
  priority: s.string<"low" | "medium" | "high">().default("medium"),
});