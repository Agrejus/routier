const schema = s.define("orders", {
  id: s.string().key().identity(),
  userId: s.string().index("user_date"), // Compound index
  date: s.date().index("user_date"), // Same compound index
  type: s.string().index("user_date"), // Same compound index
});