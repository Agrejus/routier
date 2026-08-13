const schema = s.define("users", {
  id: s.string().key().identity(),
  name: s.string(),
  middleName: s.string().optional(),
  nickname: s.string().optional(),
  avatar: s.string().optional(),
});