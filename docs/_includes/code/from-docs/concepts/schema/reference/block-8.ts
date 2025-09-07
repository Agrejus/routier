const schema = s.object({
  settings: s.record(s.string(), s.unknown()),
  metadata: s.record(s.string(), s.string()),
  config: s.record(s.string(), s.union([s.string(), s.number(), s.boolean()])),
});