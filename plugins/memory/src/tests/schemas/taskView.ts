import { type InferType, s } from "@routier/core";

export const taskViewSchema = s
    .define("taskViews", {
        id: s.string().key(), // Views must use predictable IDs, not identity keys
        title: s.string(),
        description: s.string(),
        priority: s.string("low", "medium", "high", "urgent"),
        status: s.string("pending", "in_progress", "completed", "cancelled"),
        assignee: s.string().optional(),
        originalTaskId: s.number(), // Reference to original task
        createdAt: s.date(),
    })
    .modify(x => ({
        collectionName: x.computed((_, collectionName) => collectionName).tracked()
    }))
    .compile();

export type TaskView = InferType<typeof taskViewSchema>;

