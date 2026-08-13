// Async style (recommended)
const products = await ctx.products.toArrayAsync();

// Callback style
ctx.products.toArray((result) => {
  if (result.ok === "success") {
    console.log("Products:", result.data);
  } else {
    console.error("Error:", result.error);
  }
});