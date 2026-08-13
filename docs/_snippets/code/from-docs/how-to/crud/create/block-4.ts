const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    inStock: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
    tags: s.array(s.string()).default(() => []),
  })
  .compile();

// Create product with minimal data
const newProduct = await ctx.products.addAsync({
  name: "Laptop",
  price: 999.99,
});

console.log(newProduct);
// Output: {
//   id: "generated-uuid",
//   name: "Laptop",
//   price: 999.99,
//   inStock: true,           // Default applied
//   createdAt: "2024-01-15T10:30:00.000Z", // Default applied
//   tags: []                 // Default applied
// }