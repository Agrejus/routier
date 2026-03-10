// ✅ Good - clear intent
const filterExpensiveElectronics = (minPrice: number) =>
  Queryable.compose(productSchema)
    .where(([x, p]) => x.category === "electronics", {})
    .where(([x, p]) => x.price >= p.minPrice, { minPrice });

// ❌ Bad - unclear purpose
const q1 = (p: number) => Queryable.compose(productSchema).where(...);