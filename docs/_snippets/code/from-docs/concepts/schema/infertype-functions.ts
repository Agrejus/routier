import { InferType, s } from "@routier/core/schema";

const userSchema = s.define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    name: s.string(),
    profile: s.object({
        bio: s.string().optional(),
        avatar: s.string().optional(),
        preferences: s.object({
            theme: s.string("light", "dark").default("light"),
            notifications: s.boolean().default(true),
        }),
    }),
}).compile();

type User = InferType<typeof userSchema>;

// Type-safe function parameters
function sendEmail(user: User, subject: string, body: string) {
    // TypeScript knows user.email exists and is a string
    console.log(`Sending email to ${user.email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
}

function updateUserProfile(user: User, updates: Partial<User['profile']>) {
    // TypeScript knows the exact structure of user.profile
    return {
        ...user,
        profile: { ...user.profile, ...updates }
    };
}

function getUserPreferences(user: User) {
    // TypeScript knows user.profile.preferences structure
    return {
        theme: user.profile.preferences.theme,
        notifications: user.profile.preferences.notifications,
    };
}

// Usage with full type safety
const user: User = {
    id: "user-123",
    email: "john@example.com",
    name: "John Doe",
    profile: {
        bio: "Software developer",
        preferences: {
            theme: "dark",
            notifications: true,
        },
    },
};

sendEmail(user, "Welcome!", "Thanks for joining!");
updateUserProfile(user, { bio: "Senior developer" });
const prefs = getUserPreferences(user);
