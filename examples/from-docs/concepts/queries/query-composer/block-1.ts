// Direct query - requires collection instance
const products = await dataStore.products
  .where(([p, params]) => p.category === params.category, {
    category: "electronics",
  })
  .where(([p, params]) => p.price >= params.minPrice, { minPrice: 100 })
  .toArrayAsync();