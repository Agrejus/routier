const schema = s.define("users", {
  id: s.string().key().identity(),
  email: s.string().distinct(), // Must be unique
  username: s.string().distinct(), // Must be unique
  phoneNumber: s.string().distinct(), // Must be unique
});