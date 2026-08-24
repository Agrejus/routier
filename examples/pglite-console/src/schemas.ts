import { InferType, s } from '@routier/core/schema';

/**
 * Deliberately uses the types a browser key-value store cannot index well: a nested object and
 * an array. PGlite stores both as JSONB and filters into them in SQL, which is the point of
 * running PostgreSQL here rather than IndexedDB.
 */
export const productSchema = s.define('products', {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string('tools', 'produce', 'dairy', 'bakery'),
    price: s.number(),
    tags: s.array(s.string()),
    supplier: s.object({
        name: s.string(),
        country: s.string(),
    }),
    createdAt: s.date(),
}).compile();

export type Product = InferType<typeof productSchema>;

export const CATEGORIES = ['tools', 'produce', 'dairy', 'bakery'] as const;
