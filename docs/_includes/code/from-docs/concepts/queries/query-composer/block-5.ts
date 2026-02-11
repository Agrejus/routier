// schemas/product.ts - Export your schema
export const productsSchema = s
  .define("products", {
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
  })
  .compile();

// queries/productQueries.ts - Import schema and define queries
import { productsSchema } from "../schemas/product";

export const productQueries = {
  byCategory: (category: string) =>
    Queryable.compose(productsSchema).where(
      ([x, p]) => x.category === p.category,
      { category }
    ),

  expensive: (minPrice: number) =>
    Queryable.compose(productsSchema)
      .where(([x, p]) => x.price >= p.minPrice, { minPrice })
      .sortDescending((x) => x.price),

  inStock: () =>
    Queryable.compose(productsSchema).where((x) => x.inStock === true),
};

// app.ts - Use queries with your data store
import { productQueries } from "./queries/productQueries";

const electronics = await dataStore.products
  .apply(productQueries.byCategory("electronics"))
  .toArrayAsync();