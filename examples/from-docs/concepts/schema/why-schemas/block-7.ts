const documentSchema = s.object({
  id: s.string().key().identity(),
  content: s.string().tracked(), // Track content changes
  version: s.number().identity(), // Auto-increment version
  lastModified: s.date().tracked(), // Track modification dates
  modifiedBy: s.string().tracked(), // Track who made changes
});

// With this schema, you automatically get:
// - Complete change history
// - Version control
// - Audit trails
// - Rollback capabilities