import { s } from '@routier/core';

export const eventsSchema = s.define("events", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string().default(x => x.name, { name: "James" }),
    location: s.string().optional(),
    startTime: s.date(),
    endTime: s.date().optional(),
    description: s.string().optional(),
    isOnline: s.boolean()
}).compile();