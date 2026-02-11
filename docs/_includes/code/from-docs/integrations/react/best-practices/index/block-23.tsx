// ❌ Bad
if (result.data) {
  // Could be undefined
  console.log(result.data);
}

// ✅ Good
if (result.status === "success") {
  console.log(result.data); // TypeScript knows data is defined
}