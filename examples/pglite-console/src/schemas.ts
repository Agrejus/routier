import { InferType, s } from '@routier/core/schema';

/**
 * Deliberately uses the types a browser key-value store cannot index well: a nested object and
 * an array. PGlite stores both as JSONB and filters into them in SQL, which is the point of
 * running PostgreSQL here rather than IndexedDB.
 *
 * No `s.date()` property, and that is not an oversight. An identity key combined with a date
 * fails to save against PostgreSQL — the echoed row cannot be matched back to the tracked
 * entity, because `TIMESTAMP` comes back shifted into local time. It reproduces on `main` with
 * @routier/postgresql-plugin against a real server, so it is not a PGlite defect; SQLite passes
 * because it round-trips a date unchanged. Use an explicit key if you need a date today.
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
}).compile();

export type Product = InferType<typeof productSchema>;

export const CATEGORIES = ['tools', 'produce', 'dairy', 'bakery'] as const;
