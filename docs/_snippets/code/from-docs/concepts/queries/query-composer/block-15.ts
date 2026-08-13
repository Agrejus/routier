// ✅ Good - explicit types
const filterProducts = (params: {
  category: string;
  minPrice: number;
  inStock: boolean;
}) => Queryable.compose(productSchema)...