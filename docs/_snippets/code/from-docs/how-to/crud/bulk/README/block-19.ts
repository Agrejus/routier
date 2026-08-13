// ✅ Good - track operation performance
const startTime = performance.now();
await performBulkOperation();
const duration = performance.now() - startTime;
console.log(`Bulk operation took ${duration}ms`);

// Use this data to optimize batch sizes and operations