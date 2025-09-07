try {
  const schema = s
    .object({
      // Invalid schema definition
    })
    .compile();
} catch (error) {
  console.log("Schema compilation failed:", error.message);
}