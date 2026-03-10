// Re-run when searchTerm changes
const results = useQuery(
  (cb) =>
    dataStore.products
      .where((p) => p.name.includes(searchTerm))
      .subscribe()
      .toArray(cb),
  [searchTerm] // Re-subscribe when searchTerm changes
);