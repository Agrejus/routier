import { InferType, s } from '@routier/core/schema';

/**
 * Seven collections, ~10,000 documents between them.
 *
 * Every schema carries `_id` and `_rev` because PouchDB requires both — it generates the
 * document id as `_id` and echoes it back under that name, and the plugin refuses an identity
 * key called anything else rather than corrupting reads. The other engines see two ordinary
 * columns. That is the one concession in these schemas.
 */
const identity = {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
};

export const orderSchema = s.define('orders', {
    ...identity,
    customer: s.string(),
    email: s.string(),
    status: s.string('pending', 'paid', 'shipped', 'cancelled'),
    region: s.string('us-east', 'us-west', 'eu', 'apac'),
    total: s.number(),
    items: s.number(),
    createdAt: s.date(),
}).compile();

export const productSchema = s.define('products', {
    ...identity,
    name: s.string(),
    sku: s.string(),
    category: s.string('produce', 'dairy', 'bakery', 'frozen', 'dry goods'),
    price: s.number(),
    inStock: s.number(),
}).compile();

export const customerSchema = s.define('customers', {
    ...identity,
    name: s.string(),
    email: s.string(),
    country: s.string(),
    joinedAt: s.date(),
    lifetimeValue: s.number(),
}).compile();

export const supplierSchema = s.define('suppliers', {
    ...identity,
    name: s.string(),
    country: s.string(),
    leadTimeDays: s.number(),
}).compile();

export const invoiceSchema = s.define('invoices', {
    ...identity,
    number: s.string(),
    amount: s.number(),
    paid: s.boolean(),
    issuedAt: s.date(),
}).compile();

export const shipmentSchema = s.define('shipments', {
    ...identity,
    tracking: s.string(),
    carrier: s.string('ups', 'fedex', 'dhl', 'usps'),
    delivered: s.boolean(),
    shippedAt: s.date(),
}).compile();

export const reviewSchema = s.define('reviews', {
    ...identity,
    author: s.string(),
    rating: s.number(),
    body: s.string(),
}).compile();

export type Order = InferType<typeof orderSchema>;

export const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const;
export const REGIONS = ['us-east', 'us-west', 'eu', 'apac'] as const;
export const CATEGORIES = ['produce', 'dairy', 'bakery', 'frozen', 'dry goods'] as const;
export const CARRIERS = ['ups', 'fedex', 'dhl', 'usps'] as const;
