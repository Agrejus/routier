// Live dashboard with multiple live queries
ctx.users.subscribe().count((result) => {
  if (result.ok === "success") {
    console.log("Total users:", result.data);
  }
});

ctx.products
  .where((p) => p.inStock === true)
  .subscribe()
  .count((result) => {
    if (result.ok === "success") {
      console.log("Active products:", result.data);
    }
  });

ctx.products
  .orderByDescending((p) => p.sales)
  .take(5)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Top sellers:", result.data);
    }
  });