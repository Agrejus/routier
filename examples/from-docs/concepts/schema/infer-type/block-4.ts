// schema.ts
export const userSchema = s.define("users", { ... }).compile();
export type User = InferType<typeof userSchema>;
export type CreateUser = InferCreateType<typeof userSchema>;

// other-file.ts
import { User, CreateUser } from './schema';