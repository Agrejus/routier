// ✅ Good - organized query module
export const productQueries = {
  byCategory: (category: string) => ...,
  byPriceRange: (min: number, max: number) => ...,
  inStock: () => ...,
  topRated: (limit: number) => ...
};