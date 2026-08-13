const schema = s.define("users", {
  // Primary key
  id: s.string().key().identity(),

  // Alternative keys
  email: s.string().key(),
  username: s.string().key(),

  // Composite key (multiple properties)
  orderId: s.string().key(),
  itemId: s.string().key(),
});