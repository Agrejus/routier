const schema = s.object({
  tags: s.array(s.string()),
  scores: s.array(s.number()),
  users: s.array(
    s.object({
      id: s.string(),
      name: s.string(),
    })
  ),
});