import { Books } from './store';
import { Account, Customer, Invoice, Item, Vendor } from './schemas';

/**
 * The operations a book keeps: invoice, collect, pay a bill, adjust.
 *
 * Every one posts a balanced pair of journal lines, which is what makes the trial balance a real
 * assertion rather than a restatement of what was written.
 */

export const TAX_RATE = 0.08;
const round = (value: number) => Math.round(value * 100) / 100;

export type LineDraft = { item: Item; quantity: number; description?: string };

const post = async (
    books: Books,
    entryId: string,
    postedOn: Date,
    source: 'invoice' | 'payment' | 'bill' | 'adjustment',
    sourceId: string,
    sides: { accountId: string; debit: number; credit: number; memo?: string }[]
) => {
    for (const side of sides) {
        await books.journal.addAsync({
            entryId,
            postedOn,
            accountId: side.accountId,
            debit: round(side.debit),
            credit: round(side.credit),
            source,
            sourceId,
            memo: side.memo ?? null,
        } as never);
    }
};

export const createInvoice = async (
    books: Books,
    args: {
        customer: Customer; number: number; issuedOn: Date; dueOn: Date;
        lines: LineDraft[]; memo?: string; receivable: Account;
        taxPayable: Account;
    }
): Promise<Invoice> => {
    const priced = args.lines.map(line => ({
        ...line,
        amount: round(line.item.unitPrice * line.quantity),
    }));

    const subtotal = round(priced.reduce((sum, l) => sum + l.amount, 0));
    const tax = round(priced.filter(l => l.item.taxable).reduce((sum, l) => sum + l.amount, 0) * TAX_RATE);
    const total = round(subtotal + tax);

    const [invoice] = await books.invoices.addAsync({
        number: args.number,
        customerId: args.customer.id,
        status: 'open',
        issuedOn: args.issuedOn,
        dueOn: args.dueOn,
        terms: args.customer.terms,
        memo: args.memo ?? null,
        subtotal,
        tax,
        total,
        balance: total,
    } as never);

    // Saved first: the key is assigned by the store, and the lines below reference it.
    await books.saveChangesAsync();

    for (const line of priced) {
        await books.invoiceLines.addAsync({
            invoiceId: invoice.id,
            itemId: line.item.id,
            description: line.description ?? line.item.name,
            quantity: line.quantity,
            rate: line.item.unitPrice,
            amount: line.amount,
        } as never);
    }

    // Receivable goes up by the whole invoice; income and tax payable make up the other side.
    const income = new Map<string, number>();

    for (const line of priced) {
        income.set(line.item.incomeAccountId, round((income.get(line.item.incomeAccountId) ?? 0) + line.amount));
    }

    await post(books, `inv-${invoice.id}`, args.issuedOn, 'invoice', invoice.id, [
        { accountId: args.receivable.id, debit: total, credit: 0, memo: `Invoice ${args.number}` },
        ...[...income].map(([accountId, amount]) => ({ accountId, debit: 0, credit: amount })),
        ...(tax > 0 ? [{ accountId: args.taxPayable.id, debit: 0, credit: tax }] : []),
    ]);

    await books.saveChangesAsync();

    return invoice;
};

export const recordPayment = async (
    books: Books,
    args: {
        invoice: Invoice; receivedOn: Date; amount: number;
        method: 'cash' | 'check' | 'card' | 'ach'; reference?: string;
        cash: Account; receivable: Account;
    }
) => {
    const amount = round(args.amount);

    await books.payments.addAsync({
        customerId: args.invoice.customerId,
        invoiceId: args.invoice.id,
        receivedOn: args.receivedOn,
        amount,
        method: args.method,
        reference: args.reference ?? null,
    } as never);

    const live = await books.invoices
        .where(([i, p]) => i.id === p.id, { id: args.invoice.id })
        .firstAsync();

    live.balance = round(live.balance - amount);
    live.status = live.balance <= 0 ? 'paid' : 'open';

    await post(books, `pay-${args.invoice.id}-${args.receivedOn.getTime()}`, args.receivedOn, 'payment', args.invoice.id, [
        { accountId: args.cash.id, debit: amount, credit: 0 },
        { accountId: args.receivable.id, debit: 0, credit: amount },
    ]);

    await books.saveChangesAsync();

    return live;
};

export const enterBill = async (
    books: Books,
    args: {
        vendor: Vendor; receivedOn: Date; dueOn: Date; amount: number;
        expense: Account; payable: Account;
    }
) => {
    const amount = round(args.amount);

    const [bill] = await books.bills.addAsync({
        vendorId: args.vendor.id,
        receivedOn: args.receivedOn,
        dueOn: args.dueOn,
        amount,
        paid: false,
        expenseAccountId: args.expense.id,
    } as never);

    await books.saveChangesAsync();

    await post(books, `bill-${bill.id}`, args.receivedOn, 'bill', bill.id, [
        { accountId: args.expense.id, debit: amount, credit: 0 },
        { accountId: args.payable.id, debit: 0, credit: amount },
    ]);

    await books.saveChangesAsync();

    return bill;
};

export const payBill = async (
    books: Books,
    args: { billId: string; paidOn: Date; cash: Account; payable: Account }
) => {
    const bill = await books.bills.where(([b, p]) => b.id === p.id, { id: args.billId }).firstAsync();

    bill.paid = true;

    await post(books, `billpay-${bill.id}`, args.paidOn, 'payment', bill.id, [
        { accountId: args.payable.id, debit: bill.amount, credit: 0 },
        { accountId: args.cash.id, debit: 0, credit: bill.amount },
    ]);

    await books.saveChangesAsync();

    return bill;
};

/** Voiding keeps the invoice and reverses its posting, which is what an audit trail requires. */
export const voidInvoice = async (
    books: Books,
    args: { invoiceId: string; voidedOn: Date; receivable: Account; taxPayable: Account }
) => {
    const invoice = await books.invoices.where(([i, p]) => i.id === p.id, { id: args.invoiceId }).firstAsync();
    const original = await books.journal
        .where(([j, p]) => j.sourceId === p.id && j.source === 'invoice', { id: args.invoiceId })
        .toArrayAsync();

    await post(books, `void-${invoice.id}`, args.voidedOn, 'adjustment', invoice.id,
        original.map(line => ({ accountId: line.accountId, debit: line.credit, credit: line.debit, memo: 'void' })));

    invoice.status = 'void';
    invoice.balance = 0;

    await books.saveChangesAsync();

    return invoice;
};
