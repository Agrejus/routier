const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string().index(), // Single field index
  category: s.string().index("cat_status"), // Compound index
  status: s.string().index("cat_status"), // Same compound index
  priority: s.number().index(), // Numeric index
});