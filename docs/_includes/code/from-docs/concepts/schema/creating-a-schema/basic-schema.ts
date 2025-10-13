import { s } from "@routier/core/schema";

// Basic schema definition
const userSchema = s
    .define("users", {
        id: s.string().key().identity(),
        email: s.string().distinct(),
        name: s.string(),
        createdAt: s.date().default(() => new Date()),
    })
    .compile();
