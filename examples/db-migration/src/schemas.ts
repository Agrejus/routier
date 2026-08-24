import { InferType, s } from '@routier/core/schema';

// The key is `_id` and `_rev` rides along because PouchDB requires both. The other
// databases just see two ordinary columns. That is the one concession in this schema.
export const orderSchema = s.define('orders', {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    customer: s.string(),
    email: s.string(),
    status: s.string('pending', 'paid', 'shipped', 'cancelled'),
    region: s.string('us-east', 'us-west', 'eu', 'apac'),
    total: s.number(),
    items: s.number(),
    createdAt: s.date(),
}).compile();

export type Order = InferType<typeof orderSchema>;

export const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const;
export const REGIONS = ['us-east', 'us-west', 'eu', 'apac'] as const;
