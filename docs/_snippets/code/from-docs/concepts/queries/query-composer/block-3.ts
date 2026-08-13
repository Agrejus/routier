// Import the schema directly
import { productsSchema } from "./schemas/product";

// Compose queries without needing a data store instance
const filterByCategory = (category: string) =>
  Queryable.compose(productsSchema).where(
    ([x, p]) => x.category === p.category,
    { category }
  );

// Use it with any collection that uses this schema
const results = await dataStore.products
  .apply(filterByCategory("electronics"))
  .toArrayAsync();