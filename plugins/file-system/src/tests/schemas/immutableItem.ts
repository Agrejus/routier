import { s } from '@routier/core';

export const immutableItemSchema = s.define("immutable", {
    _id: s.string().key(),
    _rev: s.string(),
    name: s.string(),
}).compile();