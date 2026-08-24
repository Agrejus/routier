import { InferType, s } from '@routier/core/schema';

/**
 * Seven collections, ~10,000 documents between them.
 *
 * Every schema carries `_id` and `_rev` because PouchDB requires both: it generates the document
 * id as `_id` and echoes it back under that name, and the plugin refuses an identity key called
 * anything else rather than corrupting reads.
 *
 * Each also carries a `documentType`, and each collection scopes itself to it. PouchDB stores
 * documents rather than tables, so one database holds every collection and a collection has to
 * filter itself out of the rest. Without it every collection reads every other collection's
 * documents, which is what the plugin's README says it does.
 *
 * The other engines see three ordinary columns and one redundant predicate. That is the
 * concession these schemas make for the document store in the lineup.
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
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const productSchema = s.define('products', {
    ...identity,
    name: s.string(),
    sku: s.string(),
    category: s.string('produce', 'dairy', 'bakery', 'frozen', 'dry goods'),
    price: s.number(),
    inStock: s.number(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const customerSchema = s.define('customers', {
    ...identity,
    name: s.string(),
    email: s.string(),
    country: s.string(),
    joinedAt: s.date(),
    lifetimeValue: s.number(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const supplierSchema = s.define('suppliers', {
    ...identity,
    name: s.string(),
    country: s.string(),
    leadTimeDays: s.number(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const invoiceSchema = s.define('invoices', {
    ...identity,
    number: s.string(),
    amount: s.number(),
    paid: s.boolean(),
    issuedAt: s.date(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const shipmentSchema = s.define('shipments', {
    ...identity,
    tracking: s.string(),
    carrier: s.string('ups', 'fedex', 'dhl', 'usps'),
    delivered: s.boolean(),
    shippedAt: s.date(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const reviewSchema = s.define('reviews', {
    ...identity,
    author: s.string(),
    rating: s.number(),
    body: s.string(),
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export type Order = InferType<typeof orderSchema>;

export const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const;
export const REGIONS = ['us-east', 'us-west', 'eu', 'apac'] as const;
export const CATEGORIES = ['produce', 'dairy', 'bakery', 'frozen', 'dry goods'] as const;
export const CARRIERS = ['ups', 'fedex', 'dhl', 'usps'] as const;
