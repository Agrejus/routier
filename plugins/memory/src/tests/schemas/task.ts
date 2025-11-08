import { type InferType, s } from "@routier/core";

export const taskSchema = s
    .define("tasks", {
        id: s.number().key().identity(),
        title: s.string(),
        description: s.string(),
        priority: s.string("low", "medium", "high", "urgent"),
        status: s.string("pending", "in_progress", "completed", "cancelled"),
        assignee: s.string().optional(),
        dueDate: s.date().optional(),
        estimatedHours: s.number().optional(),
        tags: s.string().optional(), // comma-separated tags
        createdAt: s.date().default(() => new Date()),
        updatedAt: s.date().default(() => new Date()),
    })
    .modify(x => ({
        collectionName: x.computed((_, collectionName) => collectionName).tracked()
    }))
    .compile();

export type Task = InferType<typeof taskSchema>;
export type CreatableTask = InferType<typeof taskSchema>;