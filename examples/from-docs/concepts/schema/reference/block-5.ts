const schema = s.object({
  role: s.literal("admin", "user", "moderator"),
  type: s.literal("post", "comment", "user"),
  status: s.literal("draft", "published", "archived"),
});