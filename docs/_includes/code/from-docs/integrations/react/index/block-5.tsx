if (products.status === "success") {
  // TypeScript knows products.data is defined here
  console.log(products.data); // ✅ Safe
}