import { s } from '@routier/core';

// A more practical example showing computed and function modifiers
export const userProfileSchema = s.define("userProfiles", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    firstName: s.string(),
    lastName: s.string(),
    email: s.string(),
    dateOfBirth: s.date(),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zipCode: s.string(),
        country: s.string()
    }),
    preferences: s.object({
        theme: s.string("light", "dark"),
        notifications: s.boolean(),
        language: s.string()
    }),
    lastLoginAt: s.date().optional(),
    createdAt: s.date().default(() => new Date())
}).modify(w => ({
    // Computed: Full name derived from first and last name
    fullName: w.computed(w => `${w.firstName} ${w.lastName}`),

    // Computed: Age calculated from date of birth
    age: w.computed(w => {
        const today = new Date();
        const birthDate = new Date(w.dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }),

    // Computed: Formatted address string
    formattedAddress: w.computed(w =>
        `${w.address.street}, ${w.address.city}, ${w.address.state} ${w.address.zipCode}, ${w.address.country}`
    ),

    // Computed: User status based on login activity 
    isActive: w.computed(w => {
        if (!w.lastLoginAt) return false;
        const daysSinceLogin = (Date.now() - w.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLogin <= 30;
    }),

    // Function: Generate a display name with custom formatting
    getDisplayName: w.function(w => (format: 'short' | 'full') => {
        switch (format) {
            case 'short':
                return w.firstName;
            case 'full':
                return `${w.lastName}, ${w.firstName}`;
            default:
                return `${w.lastName}, ${w.firstName}`;
        }
    }),

    // Computed: Collection metadata (tracked so it saves to the underlying datastore)
    documentType: w.computed((_, collectionName) => collectionName).tracked()
})).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();