const schema = s.define("users", {
  // Only true allowed
  verified: s.boolean<true>(),

  // Only false allowed
  disabled: s.boolean<false>(),

  // With modifiers
  isAdmin: s.boolean<true>().optional(),
});