import { InferCreateType, InferType, s } from '@routier/core';

// Shared types for the client
export type UUID = string;

export const userSchema = s.define("users", {
    id: s.string().constrain<UUID>().key().identity(),
    userRef: s.string(),
    isSuperAdmin: s.boolean().default(false),
    createdAt: s.number(),
    updatedAt: s.number().optional(),
    metadataJson: s.object({
        email: s.string().optional(),
        firstName: s.string().optional(),
        lastName: s.string().optional(),
    }).optional(),
}).modify(x => ({
    _collectionName: x.computed((_, collectionName) => collectionName).tracked(),
    createdDate: x.computed(e => new Date(e.createdAt)),
    updatedDate: x.computed(e => e.updatedAt ? new Date(e.updatedAt) : null),
})).compile();

export type User = InferType<typeof userSchema>;
export type CreatableUser = InferCreateType<typeof userSchema>;