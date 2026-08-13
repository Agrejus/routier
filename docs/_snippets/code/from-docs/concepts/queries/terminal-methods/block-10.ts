// Live query - will update when data changes
ctx.products
  .where((p) => p.price > 100)
  .subscribe()
  .toArrayAsync();