const productSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().index(), // Indexed for fast searches
  category: s.string().index("cat_price"), // Compound index
  price: s.number().index("cat_price"), // Same compound index
  tags: s.array(s.string()).index(), // Array indexing
});

// This schema automatically creates:
// - Single field indexes for fast lookups
// - Compound indexes for multi-field queries
// - Array indexes for tag-based searches
// - Optimized query plans