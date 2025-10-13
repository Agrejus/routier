import { s } from "@routier/core/schema";

// Change tracking and history example
const documentSchema = s.define("documents", {
    id: s.string().key().identity(),
    title: s.string(),
    content: s.string(),
    author: s.string(),
    version: s.number().default(1),
    createdAt: s.date().default(() => new Date()).readonly(),
    updatedAt: s.date().default(() => new Date()),
}).modify(w => ({
    // Computed properties for change tracking
    hasChanges: w.computed((entity) =>
        entity.version > 1,
        {}
    ).tracked(),

    // Function for history management
    getVersionInfo: w.function((entity) => ({
        version: entity.version,
        lastModified: entity.updatedAt,
        isModified: entity.version > 1,
    })),
})).compile();

// Schemas enable powerful change tracking features:
// - Automatic version management
// - Change detection and history
// - Audit trails and logging
// - Optimistic updates
// - Conflict resolution
// - Rollback capabilities
// - Change notifications
