await ctx.products
  .join(store => store.productSummaries, p => p._id, summary => summary.productId)
  .toArrayAsync();