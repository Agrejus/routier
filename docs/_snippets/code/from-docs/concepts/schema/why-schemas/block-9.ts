const productSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().min(1).max(200).index(),
  description: s.string().max(1000),
  price: s.number().min(0).precision(2).index(),
  category: s.string().index(),
  tags: s.array(s.string()).index(),
  images: s.array(s.string().url()),
  inStock: s.boolean().default(true),
  rating: s.number().min(0).max(5).default(0),
  reviewCount: s.number().min(0).default(0),
  averageRating: s
    .number()
    .computed((product) =>
      product.reviewCount > 0 ? product.rating / product.reviewCount : 0
    ),
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().tracked(),
});

// Benefits:
// - Type-safe price constraints
// - Efficient category and tag searches
// - Computed average rating
// - Change tracking for inventory management
// - Type-safe product operations