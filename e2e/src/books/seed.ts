import { Books } from './store';
import { createInvoice, enterBill, payBill, recordPayment, voidInvoice } from './ledger';
import { Account, Customer, Item, Vendor } from './schemas';

/** A fixed date so every dated assertion is exact rather than relative to the run. */
export const DAY = (n: number) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));

export type Seeded = {
    accounts: Record<'cash' | 'receivable' | 'payable' | 'taxPayable' | 'equity' | 'services' | 'goods' | 'rent' | 'software', Account>;
    customers: Customer[];
    vendors: Vendor[];
    items: Item[];
};

export const seedBooks = async (books: Books): Promise<Seeded> => {
    const accounts = await books.accounts.addAsync(
        { code: '1000', name: 'Cash', kind: 'asset', parentId: null } as never,
        { code: '1200', name: 'Accounts Receivable', kind: 'asset', parentId: null } as never,
        { code: '2000', name: 'Accounts Payable', kind: 'liability', parentId: null } as never,
        { code: '2200', name: 'Sales Tax Payable', kind: 'liability', parentId: null } as never,
        { code: '3000', name: 'Owner Equity', kind: 'equity', parentId: null } as never,
        { code: '4000', name: 'Service Income', kind: 'income', parentId: null } as never,
        { code: '4100', name: 'Product Income', kind: 'income', parentId: null } as never,
        { code: '5000', name: 'Rent Expense', kind: 'expense', parentId: null } as never,
        { code: '5100', name: 'Software Expense', kind: 'expense', parentId: null } as never,
    );

    await books.saveChangesAsync();

    const [cash, receivable, payable, taxPayable, equity, services, goods, rent, software] = accounts;

    const customers = await books.customers.addAsync(
        {
            name: 'Aurora Labs', code: 'CUS-001', phone: '+1-503-0100', notes: 'Priority retainer client, copper fittings and consulting.', region: 'west', openingCents: 1250.75, taxId: 'TX-AUR', email: 'ap@aurora.test', terms: 'net30', tags: ['priority', 'saas'],
            billing: { city: 'Portland', region: 'OR', postcode: '97201' },
            creditLimit: 10000, active: true, openedOn: DAY(1), legacyRef: 'L-001',
        } as never,
        {
            name: 'Beacon Foods', code: 'CUS-002', phone: '+1-512-0200', notes: 'Retail grocery chain, timber crates and pallets.', region: 'south', openingCents: 0, taxId: 'TX-BEA', email: null, terms: 'net15', tags: ['retail'],
            billing: { city: 'Austin', region: 'TX', postcode: '73301' },
            creditLimit: 2500, active: true, openedOn: DAY(2), legacyRef: null,
        } as never,
        {
            name: 'Cedar Works', code: 'CUS-003', phone: '+1-208-0300', notes: 'Dormant account, copper pipe supplier.', region: 'west', openingCents: 40.5, taxId: 'TX-CED', email: 'billing@cedar.test', terms: 'due-on-receipt', tags: [],
            billing: { city: 'Boise', region: 'ID', postcode: '83702' },
            creditLimit: 0, active: false, openedOn: DAY(3), legacyRef: 'L-003',
        } as never,
        {
            name: 'Delta Freight', code: 'CUS-004', phone: '+1-775-0400', notes: 'Logistics partner, priority freight and timber haulage.', region: 'west', openingCents: 9999.99, taxId: 'TX-DEL', email: 'ops@delta.test', terms: 'net60', tags: ['logistics', 'priority'],
            billing: { city: 'Reno', region: 'NV', postcode: '89501' },
            creditLimit: 50000, active: true, openedOn: DAY(4), legacyRef: null,
        } as never,
    );

    const vendors = await books.vendors.addAsync(
        { name: 'Property Group', category: 'facilities' } as never,
        { name: 'Toolchain Inc', category: 'software' } as never,
    );

    const items = await books.items.addAsync(
        { sku: 'CONSULT', name: 'Consulting hour', unitPrice: 150, taxable: false, incomeAccountId: services.id, embedding: [1, 0, 0, 0] } as never,
        { sku: 'WIDGET', name: 'Widget', unitPrice: 25, taxable: true, incomeAccountId: goods.id, embedding: [0, 1, 0, 0] } as never,
        { sku: 'SUPPORT', name: 'Support plan', unitPrice: 500, taxable: false, incomeAccountId: services.id, embedding: [0.9, 0.1, 0, 0] } as never,
    );

    await books.saveChangesAsync();

    const [aurora, beacon, cedar, delta] = customers;
    const [consulting, widget, support] = items;

    // Opening equity, so assets do not start out of balance.
    await books.journal.addAsync(
        { entryId: 'open', postedOn: DAY(1), accountId: cash.id, debit: 5000, credit: 0, source: 'adjustment', sourceId: 'open', memo: 'opening' } as never,
        { entryId: 'open', postedOn: DAY(1), accountId: equity.id, debit: 0, credit: 5000, source: 'adjustment', sourceId: 'open', memo: 'opening' } as never,
    );

    await books.saveChangesAsync();

    const shared = { receivable, taxPayable };

    const first = await createInvoice(books, {
        customer: aurora, number: 1001, issuedOn: DAY(5), dueOn: DAY(35), memo: 'January retainer',
        lines: [{ item: consulting, quantity: 10 }, { item: widget, quantity: 4 }], ...shared,
    });

    const second = await createInvoice(books, {
        customer: beacon, number: 1002, issuedOn: DAY(6), dueOn: DAY(21),
        lines: [{ item: widget, quantity: 20 }], ...shared,
    });

    const third = await createInvoice(books, {
        customer: delta, number: 1003, issuedOn: DAY(7), dueOn: DAY(67),
        lines: [{ item: support, quantity: 2 }, { item: consulting, quantity: 3 }], ...shared,
    });

    const fourth = await createInvoice(books, {
        customer: cedar, number: 1004, issuedOn: DAY(8), dueOn: DAY(8),
        lines: [{ item: widget, quantity: 1 }], ...shared,
    });

    // Paid in full, part-paid, untouched, and voided — one invoice in each state.
    await recordPayment(books, { invoice: second, receivedOn: DAY(10), amount: second.total, method: 'ach', reference: 'ACH-77', cash, receivable });
    await recordPayment(books, { invoice: first, receivedOn: DAY(12), amount: 500, method: 'check', reference: 'CHK-1', cash, receivable });
    await voidInvoice(books, { invoiceId: fourth.id, voidedOn: DAY(13), receivable, taxPayable });

    const rentBill = await enterBill(books, { vendor: vendors[0], receivedOn: DAY(9), dueOn: DAY(24), amount: 1800, expense: rent, payable });
    await enterBill(books, { vendor: vendors[1], receivedOn: DAY(11), dueOn: DAY(41), amount: 240, expense: software, payable });
    await payBill(books, { billId: rentBill.id, paidOn: DAY(14), cash, payable });

    void third;

    return {
        accounts: { cash, receivable, payable, taxPayable, equity, services, goods, rent, software },
        customers,
        vendors,
        items,
    };
};
