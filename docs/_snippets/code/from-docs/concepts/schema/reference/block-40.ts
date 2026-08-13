const result = schema.validate(data);
if (!result.valid) {
  result.errors.forEach((error) => {
    console.log(`Field ${error.field}: ${error.message}`);
  });
}