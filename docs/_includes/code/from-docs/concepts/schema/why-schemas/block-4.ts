const userSchema = s.object({
  id: s.string().key().identity(), // Auto-generates IDs
  email: s.string().email().unique(), // Enforces uniqueness
  name: s.string().index(), // Creates database indexes
  lastLogin: s.date().tracked(), // Tracks changes
  fullName: s.string().computed(
    (
      user // Computed property
    ) => `${user.firstName} ${user.lastName}`
  ),
});

// This schema automatically provides:
// - Unique ID generation
// - Email uniqueness enforcement
// - Database indexing for efficient queries
// - Change tracking for audit trails
// - Computed full name that updates automatically