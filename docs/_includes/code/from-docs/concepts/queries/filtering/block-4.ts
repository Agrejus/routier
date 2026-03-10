// Start with base collection
let query = dataStore.products;

// Conditionally add filters based on logic
// Always use parameterized queries when using variables
if (shouldFilterByCategory) {
  query = query.where(([p, params]) => p.category === params.category, {
    category: "electronics",
  });
}

if (minPrice > 0) {
  query = query.where(([p, params]) => p.price >= params.minPrice, {
    minPrice,
  });
}

// Execute after building
const results = await query.toArrayAsync();