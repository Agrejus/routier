import { s } from '@routier/core/schema';
import { InferType } from '@routier/core/schema';

/**
 * A double-entry book, shaped to use every schema feature at least once.
 *
 * The invariant the whole suite rests on: every posting has a matching pair, so the sum of every
 * debit minus every credit is exactly zero. A report that disagrees means a query lost a row.
 */

export const ACCOUNT_KINDS = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
export const INVOICE_STATUSES = ['draft', 'open', 'paid', 'void'] as const;
export const TERMS = ['due-on-receipt', 'net15', 'net30', 'net60'] as const;

/** Renames, computed+tracked, nullable, optional, defaults, arrays, nested objects. */
export const customerSchema = s.define('books_customers', {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().nullable(),
    terms: s.string(...TERMS).default(() => 'net30' as const),
    tags: s.array(s.string()),
    billing: s.object({
        city: s.string(),
        region: s.string(),
        postcode: s.string(),
    }),
    creditLimit: s.number().default(() => 0),
    active: s.boolean().default(() => true),
    openedOn: s.date(),
    code: s.string().index('books_customer_code').distinct(),
    phone: s.string().optional(),
    notes: s.string({ maxLength: 4000 }).searchable(),
    region: s.string().tag('reporting'),
    openingCents: s.number()
        .serialize(value => Math.round((value as number) * 100))
        .deserialize(value => Number(value) / 100),
    taxId: s.string().readonly(),
    // Stored under a different column than the one selectors use.
    legacyRef: s.string().from('legacy_ref').nullable(),
    deletedAt: s.date().nullable().default(() => null),
}).modify(x => ({
    displayName: x.computed(entity => `${entity.name} (${entity.billing.region})`).tracked(),
})).compile();

export const vendorSchema = s.define('books_vendors', {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    active: s.boolean().default(() => true),
}).compile();

/** The chart of accounts. `parentId` is a self-reference, so a join reads its own collection. */
export const accountSchema = s.define('books_accounts', {
    id: s.string().key().identity(),
    code: s.string(),
    name: s.string(),
    kind: s.string(...ACCOUNT_KINDS),
    parentId: s.string().nullable(),
    active: s.boolean().default(() => true),
}).compile();

export const itemSchema = s.define('books_items', {
    id: s.string().key().identity(),
    sku: s.string(),
    name: s.string(),
    unitPrice: s.number(),
    taxable: s.boolean(),
    incomeAccountId: s.string().foreignKey(accountSchema, 'id'),
    embedding: s.vector(4),
}).compile();

export const invoiceSchema = s.define('books_invoices', {
    id: s.string().key().identity(),
    number: s.number(),
    customerId: s.string(),
    status: s.string(...INVOICE_STATUSES),
    issuedOn: s.date(),
    dueOn: s.date(),
    terms: s.string(...TERMS),
    memo: s.string().nullable(),
    subtotal: s.number(),
    tax: s.number(),
    total: s.number(),
    balance: s.number(),
}).compile();

export const invoiceLineSchema = s.define('books_invoice_lines', {
    id: s.string().key().identity(),
    invoiceId: s.string(),
    itemId: s.string(),
    description: s.string(),
    quantity: s.number(),
    rate: s.number(),
    amount: s.number(),
}).compile();

export const paymentSchema = s.define('books_payments', {
    id: s.string().key().identity(),
    customerId: s.string(),
    invoiceId: s.string(),
    receivedOn: s.date(),
    amount: s.number(),
    method: s.string('cash', 'check', 'card', 'ach'),
    reference: s.string().nullable(),
}).compile();

export const billSchema = s.define('books_bills', {
    id: s.string().key().identity(),
    vendorId: s.string(),
    receivedOn: s.date(),
    dueOn: s.date(),
    amount: s.number(),
    paid: s.boolean(),
    expenseAccountId: s.string(),
}).compile();

/** One row per side of a posting. Debits are positive, credits negative, and they must cancel. */
export const journalLineSchema = s.define('books_journal_lines', {
    id: s.string().key().identity(),
    entryId: s.string(),
    postedOn: s.date(),
    accountId: s.string(),
    debit: s.number(),
    credit: s.number(),
    source: s.string('invoice', 'payment', 'bill', 'adjustment'),
    sourceId: s.string(),
    memo: s.string().nullable(),
}).compile();

export type Customer = InferType<typeof customerSchema>;
export type Vendor = InferType<typeof vendorSchema>;
export type Account = InferType<typeof accountSchema>;
export type Item = InferType<typeof itemSchema>;
export type Invoice = InferType<typeof invoiceSchema>;
export type InvoiceLine = InferType<typeof invoiceLineSchema>;
export type Payment = InferType<typeof paymentSchema>;
export type Bill = InferType<typeof billSchema>;
export type JournalLine = InferType<typeof journalLineSchema>;

export const receiptSchema = s.define('books_receipts', {
    id: s.string().key().identity(),
    billId: s.string(),
    label: s.string(),
    scan: s.file(),
}).compile();

export type Receipt = InferType<typeof receiptSchema>;
