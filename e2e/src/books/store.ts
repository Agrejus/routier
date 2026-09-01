import { IDbPlugin } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { BlobDbPlugin, createFiles, memoryBlobStore } from '@routier/blob-plugin';
import {
    accountSchema, billSchema, customerSchema, invoiceLineSchema, invoiceSchema,
    itemSchema, journalLineSchema, paymentSchema, receiptSchema, vendorSchema,
} from './schemas';

/**
 * One store, every tracking mode.
 *
 * `proxy` where entities are edited in place, `diff` where a snapshot is compared on save, and
 * `immutable` for the append-only ledgers — a posted journal line is never edited.
 * Customers soft-delete, because a customer with history cannot be removed.
 */
export type BooksFiles = ReturnType<typeof createFiles>;

export const booksPlugin = (plugin: IDbPlugin) => {
    const files = createFiles(memoryBlobStore());

    return { plugin: new BlobDbPlugin(plugin, files), files };
};

export class Books extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    customers = this.collection(customerSchema)
        .fullTextSearch()
        .softDelete(x => x.deletedAt)
        .proxy()
        .create();

    vendors = this.collection(vendorSchema).proxy().create();
    accounts = this.collection(accountSchema).diff().create();
    items = this.collection(itemSchema).diff().create();
    invoices = this.collection(invoiceSchema).proxy().create();
    invoiceLines = this.collection(invoiceLineSchema).immutable().create();
    payments = this.collection(paymentSchema).immutable().create();
    bills = this.collection(billSchema).proxy().create();
    journal = this.collection(journalLineSchema).immutable().create();
    receipts = this.collection(receiptSchema).proxy().create();
}
