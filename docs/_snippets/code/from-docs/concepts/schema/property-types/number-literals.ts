import { s } from "@routier/core/schema";

// Number literals within schemas
const taskSchema = s.define("tasks", {
    priority: s.number(1, 2, 3, 4, 5),
    level: s.number(0, 1, 2, 3),
    rating: s.number(1, 2, 3, 4, 5),
}).compile();
