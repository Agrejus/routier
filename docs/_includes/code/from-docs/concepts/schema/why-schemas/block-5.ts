// Define once, use everywhere
const userSchema = s.object({
  id: s.string().key().identity(),
  email: s.string().email(),
  name: s.string(),
});

// In your data store
const users = dataStore.collection(userSchema).create();

// In your API layer
app.post("/users", (req, res) => {
  const result = userSchema.validate(req.body);
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  // Data structure matches schema
});

// In your frontend
const createUser = async (userData: CreateUser) => {
  // TypeScript ensures userData matches the schema
  const response = await fetch("/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
};