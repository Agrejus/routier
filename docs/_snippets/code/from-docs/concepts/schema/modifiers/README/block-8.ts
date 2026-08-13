const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string(),
  avatar: s.string().nullable(),
  lastLogin: s.date().nullable(),
});