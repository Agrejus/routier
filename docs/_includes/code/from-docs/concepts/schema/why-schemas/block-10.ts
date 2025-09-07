const userSchema = s.object({
  id: s.string().key().identity(),
  email: s.string().email().unique().index(),
  username: s.string().min(3).max(30).unique().index(),
  password: s
    .string()
    .min(8)
    .validate((password) => {
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      return hasUpper && hasLower && hasNumber;
    }),
  firstName: s.string().min(1).max(50),
  lastName: s.string().min(1).max(50),
  fullName: s.string().computed((user) => `${user.firstName} ${user.lastName}`),
  role: s.literal("user", "moderator", "admin").default("user"),
  isActive: s.boolean().default(true),
  lastLogin: s.date().tracked(),
  loginCount: s.number().min(0).default(0),
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().tracked(),
});

// Benefits:
// - Secure password constraints
// - Unique email and username enforcement
// - Automatic full name computation
// - Role-based access control
// - Login tracking and analytics