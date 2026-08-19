import { InferType, s } from '@routier/core/schema';

export const userSchema = s.define('users', {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string(),
}).compile();

export const accountSchema = s.define('accounts', {
    id: s.string().key().identity(),
    ownerId: s.string(),
    name: s.string(),
    kind: s.string('checking', 'savings', 'credit'),
    balance: s.number(),
}).compile();

export const transactionSchema = s.define('transactions', {
    id: s.string().key().identity(),
    fromAccountId: s.string(),
    toAccountId: s.string(),
    amount: s.number(),
    category: s.string('transfer', 'payroll', 'groceries', 'rent', 'utilities', 'entertainment'),
    memo: s.string(),
    at: s.date(),
}).compile();

export const instrumentSchema = s.define('instruments', {
    id: s.string().key().identity(),
    symbol: s.string(),
    price: s.number(),
    change: s.number(),
    updatedAt: s.date(),
}).compile();

// Read off the schemas rather than restated. Adding a property or widening a string union
// above updates these with no second edit, and nothing can drift out of step.
export type User = InferType<typeof userSchema>;
export type Account = InferType<typeof accountSchema>;
export type Transaction = InferType<typeof transactionSchema>;
export type Instrument = InferType<typeof instrumentSchema>;

export const CATEGORIES = ['transfer', 'payroll', 'groceries', 'rent', 'utilities', 'entertainment'] as const;
