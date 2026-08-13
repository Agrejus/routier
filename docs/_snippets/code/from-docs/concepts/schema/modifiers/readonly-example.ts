import { s } from "@routier/core/schema";

// Readonly properties within schemas
const auditSchema = s.define("audit", {
    id: s.string().key().identity(),
    action: s.string(),

    // Readonly properties (cannot be modified after creation)
    createdAt: s.date().readonly().default(() => new Date()),
    createdBy: s.string().readonly(),

    // Readonly with other modifiers
    version: s.number().readonly().default(1),
}).compile();
