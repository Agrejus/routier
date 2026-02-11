const page = 2;
const pageSize = 20;
const offset = (page - 1) * pageSize;

const products = await dataStore.products
  .where(([p, params]) => p.inStock === true, {})
  .skip(offset)
  .take(pageSize)
  .toArrayAsync();