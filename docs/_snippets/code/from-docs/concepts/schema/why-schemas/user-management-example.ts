import { s } from "@routier/core/schema";

// User management system schema example
const userManagementSchema = s.define("userManagement", {
    users: s.object({
        id: s.string().key().identity(),
        email: s.string().distinct(),
        username: s.string().distinct(),
        passwordHash: s.string(),
        profile: s.object({
            firstName: s.string(),
            lastName: s.string(),
            avatar: s.string().optional(),
            bio: s.string().optional(),
        }),
        role: s.string("admin", "moderator", "user").default("user"),
        isActive: s.boolean().default(true),
        lastLogin: s.date().optional(),
        createdAt: s.date().default(() => new Date()).readonly(),
    }),

    sessions: s.object({
        id: s.string().key().identity(),
        userId: s.string().index("user_sessions"),
        token: s.string().distinct(),
        expiresAt: s.date(),
        createdAt: s.date().default(() => new Date()),
    }),

    permissions: s.object({
        id: s.string().key().identity(),
        userId: s.string().index("user_permissions"),
        resource: s.string(),
        action: s.string("read", "write", "delete"),
        granted: s.boolean().default(false),
    }),
}).compile();

// This schema provides:
// - Secure user data management
// - Role-based access control
// - Session management
// - Permission tracking
// - Audit trails (createdAt, lastLogin)
// - Type safety for all user operations
