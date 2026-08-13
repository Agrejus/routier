// Validate at the boundary of your system
app.post("/users", (req, res) => {
  const result = userSchema.validate(req.body);
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  // Process valid data
});