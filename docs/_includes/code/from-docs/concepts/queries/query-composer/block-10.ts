class ProductQueryFactory {
  static byCategory(category: string) {
    return Queryable.compose(productSchema).where(
      ([x, p]) => x.category === p.category,
      { category }
    );
  }

  static byPriceRange(minPrice: number, maxPrice: number) {
    return Queryable.compose(productSchema).where(
      ([x, p]) => x.price >= p.minPrice && x.price <= p.maxPrice,
      {
        minPrice,
        maxPrice,
      }
    );
  }

  static inStock() {
    return Queryable.compose(productSchema).where((x) => x.inStock === true);
  }

  static topExpensive(limit: number) {
    return Queryable.compose(productSchema)
      .sortDescending((x) => x.price)
      .take(limit);
  }
}

// Usage
const electronics = await dataStore.products
  .apply(ProductQueryFactory.byCategory("electronics"))
  .toArrayAsync();

const top10 = await dataStore.products
  .apply(ProductQueryFactory.topExpensive(10))
  .toArrayAsync();