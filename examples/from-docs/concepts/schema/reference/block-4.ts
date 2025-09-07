const schema = s.object({
  identifier: s.union([s.string(), s.number()]),
  status: s.union([
    s.literal("active"),
    s.literal("inactive"),
    s.literal("pending"),
  ]),
});