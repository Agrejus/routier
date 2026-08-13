const schema = s.define("users", {
  // Basic date
  createdAt: s.date(),

  // Date with modifiers
  updatedAt: s.date().default(() => new Date()),
  lastLogin: s.date().nullable(),
  birthDate: s.date().optional(),
  // Note: .default() accepts both direct values and functions
});