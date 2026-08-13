// Live count that updates automatically
ctx.users.subscribe().count((result) => {
  if (result.ok === "success") {
    console.log("User count:", result.data);
  }
});

// Live sum that updates automatically
ctx.products
  .where((p) => p.inStock === true)
  .subscribe()
  .sum(
    (result, selector) => {
      if (result.ok === "success") {
        console.log("Total value:", result.data);
      }
    },
    (p) => p.price
  );