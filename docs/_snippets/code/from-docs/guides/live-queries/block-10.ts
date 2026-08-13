// Good: Apply filters before subscribing
ctx.products
  .where((p) => p.price > 100)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      // Handle expensive products
    }
  });

// Less efficient: Subscribe to all data then filter
ctx.products.subscribe().toArray((result) => {
  if (result.ok === "success") {
    const expensiveProducts = result.data.filter((p) => p.price > 100);
    // Handle filtered results
  }
});