const schema = s.define("users", {
  id: s.string().key().identity().readonly(),
  createdAt: s
    .date()
    .default(() => new Date())
    .readonly(),
  version: s.number().identity().readonly(),
});