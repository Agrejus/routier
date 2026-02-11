// ❌ Bad - will not update when searchTerm changes
const products = useQuery(
  (cb) =>
    dataStore.products
      .where((p) => p.name.includes(searchTerm))
      .subscribe()
      .toArray(cb),
  [] // Missing searchTerm
);

// ✅ Good
const products = useQuery(
  (cb) =>
    dataStore.products
      .where((p) => p.name.includes(searchTerm))
      .subscribe()
      .toArray(cb),
  [searchTerm] // Include dependencies
);