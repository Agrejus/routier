import { s } from "@routier/core/schema";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number().optional(),
    isActive: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();