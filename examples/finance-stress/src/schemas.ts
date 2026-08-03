import { s } from '@routier/core/schema';

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
    version: s.number().concurrency(),
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

export type User = { id: string; name: string; email: string };
export type Account = { id: string; ownerId: string; name: string; kind: 'checking' | 'savings' | 'credit'; balance: number; version: number };
export type Transaction = {
    id: string; fromAccountId: string; toAccountId: string; amount: number;
    category: 'transfer' | 'payroll' | 'groceries' | 'rent' | 'utilities' | 'entertainment';
    memo: string; at: Date;
};

export const CATEGORIES = ['transfer', 'payroll', 'groceries', 'rent', 'utilities', 'entertainment'] as const;
