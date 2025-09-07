// ✅ Good - comprehensive error handling
try {
  await performBulkOperation();
} catch (error) {
  console.error("Operation failed:", error);
  // Handle partial success, rollback, etc.
}

// ❌ Avoid - ignoring errors
await performBulkOperation(); // Errors may go unnoticed