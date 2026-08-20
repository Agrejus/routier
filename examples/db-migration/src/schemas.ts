import { InferType, s } from '@routier/core/schema';

export const orderSchema = s.define('orders', {
    id: s.string().key().identity(),
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
