// Get page data and total count
const pageSize = 10;
const page = 1;
const offset = (page - 1) * pageSize;

const [products, totalCount] = await Promise.all([
  ctx.products.skip(offset).take(pageSize).toArrayAsync(),
  ctx.products.countAsync(),
]);