const result = schema.validate(userData);
if (result.valid) {
  // Data is valid
  const user = result.data;
} else {
  // Data is invalid
  console.log(result.errors);
}