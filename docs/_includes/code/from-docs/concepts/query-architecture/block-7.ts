const minPrice = 100;
const category = "electronics";

// ✅ Optimized - translated to database query
const optimized = await dataStore.products
  .where(
    ([p, params]) =>
      p.price >= params.minPrice && p.category === params.category,
    { minPrice, category }
  )
  .toArrayAsync();

// ⚠️ Falls back to memory filtering
const fallback = await dataStore.products
  .where((p) => p.price >= minPrice && p.category === category)
  .toArrayAsync();