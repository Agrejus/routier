// Get first 10 products
const firstPage = await ctx.products.take(10).toArrayAsync();

// Get second page (skip first 10, take next 10)
const secondPage = await ctx.products.skip(10).take(10).toArrayAsync();

// Pagination helper
const pageSize = 10;
const pageNumber = 2; // 0-based
const page = await ctx.products
  .skip(pageSize * pageNumber)
  .take(pageSize)
  .toArrayAsync();