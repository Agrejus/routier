import { s, uuidv4 } from '@routier/core';

export const usersSchema = s.define("users", {
    id: s.string().key().default(x => x.uuid(), { uuid: uuidv4 }),
    firstName: s.string(),
    lastName: s.string(),
    age: s.number(),
    createdDate: s.date().default(() => new Date("01/01/1900 8:00 AM")),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zip: s.string()
    })
}).modify(x => ({
    collectionName: x.computed((_, collectionName) => collectionName).tracked()
})).compile();