// Option 1: Access schema from data store
const filterByName = (params: { name: string }) =>
  Queryable.compose(dataStore.products.schema).where(
    ([x, p]) => x.name === p.name,
    params
  );

// Option 2: Import schema directly (recommended for reusable queries)
import { productsSchema } from "./schemas/product";

const filterByName = (params: { name: string }) =>
  Queryable.compose(productsSchema).where(
    ([x, p]) => x.name === p.name,
    params
  );

// Apply to collection
const result = await dataStore.products
  .apply(filterByName({ name: "Laptop" }))
  .firstOrUndefinedAsync();