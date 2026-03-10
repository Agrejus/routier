import { InferCreateType, InferType, s } from '@routier/core';

// Shared types for the client
export type UUID = string;

export const widgetSchema = s.define("widgets", {
    id: s.string().constrain<UUID>().key().identity(),
    time: s.number().nullable().default(() => null),
    set: s.number()
}).compile();

export type Widget = InferType<typeof widgetSchema>;
export type CreatableWidget = InferCreateType<typeof widgetSchema>;