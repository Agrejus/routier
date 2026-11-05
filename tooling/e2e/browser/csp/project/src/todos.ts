import { s } from "@routier/core/schema";

const prefix = "todo-";

export const todos = s.define("todos", {
    id: s.string().key().identity(),
    name: s.string(),
    done: s.boolean().default(false),
    meta: s.object({ owner: s.string() }),
    tags: s.string().array(),
    label: s.string().default(() => `${prefix}label`),
}).modify(x => ({
    upper: x.computed(entity => entity.name.toUpperCase()),
})).compile();
