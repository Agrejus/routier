const schema = s.define("users", {
  id: s.string().key().identity(), // Primary key
  email: s.string().key(), // Alternative key
  username: s.string().key(), // Another key
});