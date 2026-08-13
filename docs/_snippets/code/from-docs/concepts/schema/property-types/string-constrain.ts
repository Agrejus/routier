import { s } from "@routier/core/schema";

type UUID = string & { __brand: 'UUID' };
type Email = string & { __brand: 'Email' };
type UserId = string & { __brand: 'UserId' };

const userSchema = s.define("users", {
    id: s.string().constrain<UUID>().key().identity(),
    userId: s.string().constrain<UserId>(),
    email: s.string().constrain<Email>().distinct(),
    name: s.string(),
}).compile();

