// ✅ Good - single responsibility
const filterByCategory = (category: string) => ...;
const filterByPrice = (minPrice: number) => ...;

// ❌ Bad - too many responsibilities
const doEverything = (params: {...}) => ...;