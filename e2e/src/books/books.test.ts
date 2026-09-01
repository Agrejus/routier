import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { ConcurrencyDbPlugin, IDbPlugin, OptimisticConcurrencyError, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { PGliteDbPlugin } from '@routier/pglite-plugin';
import { vmModulesEnabled } from '@routier/test-utils';
import { Books, booksPlugin } from './store';
import { DAY, Seeded, seedBooks } from './seed';
import { createInvoice, recordPayment, TAX_RATE } from './ledger';

/**
 * A book kept end to end, on every plugin, asserted against hand-computed answers.
 *
 * The seed is fixed, so every total below is a number worked out on paper rather than read back
 * from the thing under test. The trial balance is the invariant: debits minus credits is zero, and
 * a query that loses a row breaks it.
 */

const ENGINES: [string, () => IDbPlugin][] = [
    ['memory', () => new MemoryPlugin(`books-${uuidv4()}`)],
    ['sqlite', () => new SqliteDbPlugin(`books-${uuidv4()}.sqlite`)],
    // PGlite reaches its filesystems through dynamic imports, so it needs --experimental-vm-modules.
    ...(vmModulesEnabled
        ? [['pglite', () => new PGliteDbPlugin(`memory://books-${uuidv4()}`)] as [string, () => IDbPlugin]]
        : []),
];

// Worked out from the seed: 10 consulting at 150 plus 4 widgets at 25, tax on the widgets only.
const INVOICE_1 = { subtotal: 1600, tax: 8, total: 1608 };
const INVOICE_2 = { subtotal: 500, tax: 40, total: 540 };
const INVOICE_3 = { subtotal: 1450, tax: 0, total: 1450 };
const INVOICE_4 = { subtotal: 25, tax: 2, total: 27 };

describe.each(ENGINES)('books on %s', (engine, factory) => {
    let books: Books;
    let seeded: Seeded;

    let files: ReturnType<typeof booksPlugin>['files'];

    beforeAll(async () => {
        const wrapped = booksPlugin(factory());
        files = wrapped.files;
        books = new Books(wrapped.plugin);
        seeded = await seedBooks(books);
    }, 120_000);

    afterAll(async () => {
        await books.destroyAsync();
    });

    describe('what the seed produced', () => {
        it('wrote every collection', async () => {
            expect(await books.accounts.countAsync()).toBe(9);
            expect(await books.customers.countAsync()).toBe(4);
            expect(await books.vendors.countAsync()).toBe(2);
            expect(await books.items.countAsync()).toBe(3);
            expect(await books.invoices.countAsync()).toBe(4);
            expect(await books.invoiceLines.countAsync()).toBe(6);
            expect(await books.payments.countAsync()).toBe(2);
            expect(await books.bills.countAsync()).toBe(2);
        });

        it('priced every invoice the way the line items say', async () => {
            const totals = await books.invoices.sort(i => i.number).map(i => ({ number: i.number, subtotal: i.subtotal, tax: i.tax, total: i.total })).toArrayAsync();

            expect(totals).toEqual([
                { number: 1001, ...INVOICE_1 },
                { number: 1002, ...INVOICE_2 },
                { number: 1003, ...INVOICE_3 },
                { number: 1004, ...INVOICE_4 },
            ]);
        });

        it('taxes only the taxable items', async () => {
            const widgets = await books.items.where(i => i.taxable).firstAsync();

            expect(widgets.sku).toBe('WIDGET');
            expect(INVOICE_2.tax).toBe(Math.round(INVOICE_2.subtotal * TAX_RATE * 100) / 100);
        });
    });

    describe('the trial balance', () => {
        it('balances to the cent', async () => {
            const debits = await books.journal.sumAsync(j => j.debit);
            const credits = await books.journal.sumAsync(j => j.credit);

            expect(Math.round((debits - credits) * 100) / 100).toBe(0);
        });

        it('balances within every entry, not just overall', async () => {
            const lines = await books.journal.toArrayAsync();
            const byEntry = new Map<string, number>();

            for (const line of lines) {
                byEntry.set(line.entryId, Math.round(((byEntry.get(line.entryId) ?? 0) + line.debit - line.credit) * 100) / 100);
            }

            expect([...byEntry].filter(([, net]) => net !== 0)).toEqual([]);
        });

        it('groups the ledger by account', async () => {
            const grouped = await books.journal.toGroupAsync(j => j.accountId);
            const accounts = Object.keys(grouped);

            const net = accounts.reduce((sum, id) => {
                const lines = grouped[id as keyof typeof grouped] as { debit: number, credit: number }[];

                return sum + lines.reduce((inner, line) => inner + line.debit - line.credit, 0);
            }, 0);

            expect(accounts.length).toBeGreaterThan(3);
            expect(Math.round(net * 100) / 100).toBe(0);
        });
    });

    describe('the balance sheet', () => {
        const balanceOf = async (b: Books, accountId: string) => {
            const debit = await b.journal.where(([j, p]) => j.accountId === p.id, { id: accountId }).sumAsync(j => j.debit);
            const credit = await b.journal.where(([j, p]) => j.accountId === p.id, { id: accountId }).sumAsync(j => j.credit);

            return Math.round((debit - credit) * 100) / 100;
        };

        it('holds the cash the payments and bills leave behind', async () => {
            // 5000 opening + 540 collected + 500 collected - 1800 rent paid.
            expect(await balanceOf(books, seeded.accounts.cash.id)).toBe(4240);
        });

        it('leaves receivable at what is still owed', async () => {
            // 1608 + 540 + 1450 + 27 invoiced, less 540 and 500 collected, less 27 voided.
            expect(await balanceOf(books, seeded.accounts.receivable.id)).toBe(2558);
        });

        it('owes the unpaid bill only', async () => {
            expect(await balanceOf(books, seeded.accounts.payable.id)).toBe(-240);
        });

        it('carries tax on the invoices that were not voided', async () => {
            expect(await balanceOf(books, seeded.accounts.taxPayable.id)).toBe(-48);
        });

        it('satisfies assets = liabilities + equity', async () => {
            const kinds = await books.accounts.toArrayAsync();
            let assets = 0, liabilities = 0, equity = 0, income = 0, expense = 0;

            for (const account of kinds) {
                const net = await balanceOf(books, account.id);

                if (account.kind === 'asset') assets += net;
                if (account.kind === 'liability') liabilities += -net;
                if (account.kind === 'equity') equity += -net;
                if (account.kind === 'income') income += -net;
                if (account.kind === 'expense') expense += net;
            }

            const retained = income - expense;

            expect(Math.round((assets - (liabilities + equity + retained)) * 100) / 100).toBe(0);
        });
    });

    describe('the profit and loss', () => {
        it('recognises income net of the void', async () => {
            const ids = (await books.accounts.where(a => a.kind === 'income').toArrayAsync()).map(a => a.id);
            const credits = await books.journal.where(([j, p]) => p.ids.includes(j.accountId), { ids }).sumAsync(j => j.credit);
            const debits = await books.journal.where(([j, p]) => p.ids.includes(j.accountId), { ids }).sumAsync(j => j.debit);

            // 1600 + 500 + 1450 + 25 invoiced, less the 25 voided.
            expect(Math.round((credits - debits) * 100) / 100).toBe(3550);
        });

        it('records both expenses whether or not the bill was paid', async () => {
            const ids = (await books.accounts.where(a => a.kind === 'expense').toArrayAsync()).map(a => a.id);
            const spend = await books.journal.where(([j, p]) => p.ids.includes(j.accountId), { ids }).sumAsync(j => j.debit);

            expect(spend).toBe(2040);
        });
    });

    describe('accounts receivable aging', () => {
        it('reports each open invoice against its due date', async () => {
            const asOf = DAY(30);
            const open = await books.invoices
                .where(i => i.status === 'open')
                .sort(i => i.number)
                .toArrayAsync();

            const aged = open.map(i => ({
                number: i.number,
                balance: i.balance,
                overdue: i.dueOn.getTime() < asOf.getTime(),
            }));

            expect(aged).toEqual([
                { number: 1001, balance: 1108, overdue: false },
                { number: 1003, balance: 1450, overdue: false },
            ]);
        });

        it('sums what is still owed', async () => {
            const owed = await books.invoices.where(i => i.status === 'open').sumAsync(i => i.balance);

            expect(owed).toBe(2558);
        });

        it('finds the largest open balance', async () => {
            expect(await books.invoices.where(i => i.status === 'open').maxAsync(i => i.balance)).toBe(1450);
            expect(await books.invoices.where(i => i.status === 'open').minAsync(i => i.balance)).toBe(1108);
        });
    });

    describe('a customer statement', () => {
        it('pairs each invoice with its customer', async () => {
            const rows = await books.invoices
                .join(x => x.customers, invoice => invoice.customerId, customer => customer.id)
                .toArrayAsync();

            expect(rows).toHaveLength(4);
            expect(rows.every(([invoice, customer]) => invoice.customerId === customer.id)).toBe(true);
        });

        it('reads the joined customer through a rename and a computed property', async () => {
            const rows = await books.invoices
                .join(x => x.customers, invoice => invoice.customerId, customer => customer.id)
                .toArrayAsync();

            const aurora = rows.find(([invoice]) => invoice.number === 1001)!;

            expect(aurora[1].name).toBe('Aurora Labs');
            expect(aurora[1].displayName).toBe('Aurora Labs (OR)');
            expect(aurora[1].legacyRef).toBe('L-001');
        });

        it('lists the payments a customer made, newest first', async () => {
            const beacon = seeded.customers[1];
            const payments = await books.payments
                .where(([p, q]) => p.customerId === q.id, { id: beacon.id })
                .sortDescending(p => p.receivedOn)
                .toArrayAsync();

            expect(payments).toHaveLength(1);
            expect(payments[0].amount).toBe(540);
            expect(payments[0].method).toBe('ach');
            expect(payments[0].reference).toBe('ACH-77');
        });
    });

    describe('the queries a books UI actually makes', () => {
        it('filters by a string union', async () => {
            expect(await books.invoices.where(i => i.status === 'paid').countAsync()).toBe(1);
            expect(await books.invoices.where(i => i.status === 'void').countAsync()).toBe(1);
            expect(await books.invoices.where(i => i.status !== 'void').countAsync()).toBe(3);
        });

        it('filters on a nullable column', async () => {
            expect(await books.customers.where(c => c.email === null).countAsync()).toBe(1);
            expect(await books.customers.where(c => c.email !== null).countAsync()).toBe(3);
        });

        it('filters on a renamed column', async () => {
            const withLegacy = await books.customers.where(c => c.legacyRef !== null).sort(c => c.name).toArrayAsync();

            expect(withLegacy.map(c => c.legacyRef)).toEqual(['L-001', 'L-003']);
        });

        it('filters on a nested property', async () => {
            const oregon = await books.customers.where(c => c.billing.region === 'OR').toArrayAsync();

            expect(oregon.map(c => c.name)).toEqual(['Aurora Labs']);
        });

        it('matches a string by prefix, suffix and substring', async () => {
            expect((await books.customers.where(c => c.name.startsWith('Aur')).toArrayAsync()).length).toBe(1);
            expect((await books.customers.where(c => c.name.endsWith('Works')).toArrayAsync()).length).toBe(1);
            expect((await books.customers.where(c => c.name.includes('e')).toArrayAsync()).length).toBe(3);
        });

        it('matches case-insensitively', async () => {
            const found = await books.customers.where(c => c.name.toLowerCase() === 'aurora labs').toArrayAsync();

            expect(found.map(c => c.name)).toEqual(['Aurora Labs']);
        });

        it('filters by a value in an array column', async () => {
            const priority = await books.customers.where(c => c.tags.includes('priority')).sort(c => c.name).toArrayAsync();

            expect(priority.map(c => c.name)).toEqual(['Aurora Labs', 'Delta Freight']);
        });

        it('filters by membership in a literal list', async () => {
            const shortTerms = await books.customers.where(c => ['net15', 'due-on-receipt'].includes(c.terms)).sort(c => c.name).toArrayAsync();

            expect(shortTerms.map(c => c.name)).toEqual(['Beacon Foods', 'Cedar Works']);
        });

        it('filters on a boolean both ways', async () => {
            expect(await books.customers.where(c => c.active).countAsync()).toBe(3);
            expect(await books.customers.where(c => !c.active).countAsync()).toBe(1);
        });

        it('filters on a date range', async () => {
            const early = await books.invoices
                .where(([i, p]) => i.issuedOn >= p.from && i.issuedOn <= p.to, { from: DAY(5), to: DAY(6) })
                .sort(i => i.number)
                .toArrayAsync();

            expect(early.map(i => i.number)).toEqual([1001, 1002]);
        });

        it('filters on arithmetic over a column', async () => {
            const bigLines = await books.invoiceLines.where(l => l.quantity * l.rate > 500).toArrayAsync();

            expect(bigLines.length).toBeGreaterThan(0);
            expect(bigLines.every(l => l.quantity * l.rate > 500)).toBe(true);
        });

        it('combines conditions with and, or and not', async () => {
            const rows = await books.invoices
                .where(i => (i.status === 'open' || i.status === 'paid') && !(i.total < 600))
                .sort(i => i.number)
                .toArrayAsync();

            expect(rows.map(i => i.number)).toEqual([1001, 1003]);
        });

        it('compares two columns', async () => {
            expect(await books.invoices.where(i => i.balance === i.total).countAsync()).toBe(1);
            expect(await books.invoices.where(i => i.balance < i.total).countAsync()).toBe(3);
        });

        it('pages with skip and take', async () => {
            const all = await books.invoices.sort(i => i.number).toArrayAsync();
            const page = await books.invoices.sort(i => i.number).skip(1).take(2).toArrayAsync();

            expect(page.map(i => i.number)).toEqual(all.slice(1, 3).map(i => i.number));
        });

        it('projects only the columns a list needs', async () => {
            const rows = await books.invoices.sort(i => i.number).map(i => i.number).toArrayAsync();

            expect(rows).toEqual([1001, 1002, 1003, 1004]);
        });

        it('answers distinct', async () => {
            const terms = await books.customers.map(c => c.terms).distinctAsync();

            expect([...terms].sort()).toEqual(['due-on-receipt', 'net15', 'net30', 'net60']);
        });

        it('projects a nested property, which is read out of its JSON column', async () => {
            const regions = await books.customers.map(c => c.billing.region).distinctAsync();

            expect([...regions].sort()).toEqual(['ID', 'NV', 'OR', 'TX']);
        });

        it('projects a nested property alongside a root one', async () => {
            const rows = await books.customers
                .sort(c => c.name)
                .map(c => ({ name: c.name, region: c.billing.region }))
                .toArrayAsync();

            expect(rows[0]).toEqual({ name: 'Aurora Labs', region: 'OR' });
            expect(rows).toHaveLength(4);
        });

        it('answers first, firstOrUndefined, some and every', async () => {
            expect((await books.invoices.sort(i => i.number).firstAsync()).number).toBe(1001);
            expect(await books.invoices.where(i => i.number === 9999).firstOrUndefinedAsync()).toBeUndefined();
            expect(await books.invoices.someAsync(i => i.status === 'void')).toBe(true);
            expect(await books.invoices.everyAsync(i => i.total > 0)).toBe(true);
            expect(await books.invoices.everyAsync(i => i.total > 1000)).toBe(false);
        });

        it('sorts both directions', async () => {
            const up = await books.invoices.sort(i => i.total).map(i => i.total).toArrayAsync();
            const down = await books.invoices.sortDescending(i => i.total).map(i => i.total).toArrayAsync();

            expect(up).toEqual([...up].sort((a, b) => a - b));
            expect(down).toEqual([...up].reverse());
        });
    });

    describe('editing the books', () => {
        it('records a payment, moves the balance and closes the invoice', async () => {
            const invoice = await books.invoices.where(i => i.number === 1003).firstAsync();
            const before = await books.journal.countAsync();

            await recordPayment(books, {
                invoice, receivedOn: DAY(20), amount: invoice.balance, method: 'card',
                cash: seeded.accounts.cash, receivable: seeded.accounts.receivable,
            });

            const after = await books.invoices.where(i => i.number === 1003).firstAsync();

            expect(after.balance).toBe(0);
            expect(after.status).toBe('paid');
            expect(await books.journal.countAsync()).toBe(before + 2);

            const debits = await books.journal.sumAsync(j => j.debit);
            const credits = await books.journal.sumAsync(j => j.credit);

            expect(Math.round((debits - credits) * 100) / 100).toBe(0);
        });

        it('adds a new invoice and keeps the books balanced', async () => {
            const created = await createInvoice(books, {
                customer: seeded.customers[0], number: 1005, issuedOn: DAY(22), dueOn: DAY(52),
                lines: [{ item: seeded.items[2], quantity: 1 }],
                receivable: seeded.accounts.receivable, taxPayable: seeded.accounts.taxPayable,
            });

            expect(created.total).toBe(500);
            expect(await books.invoices.countAsync()).toBe(5);

            const debits = await books.journal.sumAsync(j => j.debit);
            const credits = await books.journal.sumAsync(j => j.credit);

            expect(Math.round((debits - credits) * 100) / 100).toBe(0);
        });

        it('edits a customer in place and persists it', async () => {
            const customer = await books.customers.where(c => c.name === 'Delta Freight').firstAsync();

            customer.creditLimit = 75000;
            customer.tags.push('reviewed');
            await books.saveChangesAsync();

            const reread = await books.customers.where(c => c.name === 'Delta Freight').firstAsync();

            expect(reread.creditLimit).toBe(75000);
            expect(reread.tags).toContain('reviewed');
        });

        it('keeps a computed property in step with the column it reads', async () => {
            const customer = await books.customers.where(c => c.name === 'Beacon Foods').firstAsync();

            expect(customer.displayName).toBe('Beacon Foods (TX)');

            customer.billing.region = 'CA';
            await books.saveChangesAsync();

            const reread = await books.customers.where(c => c.name === 'Beacon Foods').firstAsync();

            expect(reread.displayName).toBe('Beacon Foods (CA)');
        });

        it('soft-deletes a customer, so it leaves the reads but keeps its history', async () => {
            const before = await books.customers.countAsync();
            const cedar = await books.customers.where(c => c.name === 'Cedar Works').firstAsync();
            const theirInvoices = await books.invoices.where(([i, p]) => i.customerId === p.id, { id: cedar.id }).countAsync();

            await books.customers.removeAsync(cedar);
            await books.saveChangesAsync();

            expect(await books.customers.countAsync()).toBe(before - 1);
            expect(await books.customers.where(c => c.name === 'Cedar Works').firstOrUndefinedAsync()).toBeUndefined();
            expect(await books.invoices.where(([i, p]) => i.customerId === p.id, { id: cedar.id }).countAsync()).toBe(theirInvoices);
        });
    });

    describe('the reports that need a left join', () => {
        it('lists every invoice, including the ones with no payment against them', async () => {
            const pairs = await books.invoices
                .leftJoin(x => x.payments, invoice => invoice.id, payment => payment.invoiceId)
                .toArrayAsync();

            const unpaid = pairs.filter(([, payment]) => payment == null).map(([invoice]) => invoice.number);

            // An inner join would drop them, and an aging report that drops unpaid invoices is useless.
            expect(unpaid.length).toBeGreaterThan(0);
            expect(pairs.every(([invoice]) => invoice.number > 0)).toBe(true);
        });

        it('hands back undefined rather than an entity of nulls', async () => {
            const pairs = await books.invoices
                .leftJoin(x => x.payments, invoice => invoice.id, payment => payment.invoiceId)
                .toArrayAsync();

            const unmatched = pairs.find(([, payment]) => payment == null);

            expect(unmatched).toBeDefined();
            expect(unmatched![1]).toBeUndefined();
        });
    });

    describe('a live subscription', () => {
        it('sees a payment recorded after it started watching', async () => {
            const invoice = await books.invoices.where(i => i.status === 'open').sort(i => i.number).firstAsync();
            const startingBalance = invoice.balance;
            const seen: number[] = [];

            const unsubscribe = books.invoices
                .subscribe()
                .where(([i, p]) => i.id === p.id, { id: invoice.id })
                .toArray(result => {
                    if (result.ok === 'success' && result.data[0] != null) {
                        seen.push(result.data[0].balance);
                    }
                });

            await new Promise(resolve => setTimeout(resolve, 150));

            await recordPayment(books, {
                invoice, receivedOn: DAY(25), amount: 100, method: 'cash',
                cash: seeded.accounts.cash, receivable: seeded.accounts.receivable,
            });

            const expected = startingBalance - 100;

            // Propagation is asynchronous, so this waits for the value rather than for a duration.
            for (let attempt = 0; attempt < 40 && seen.includes(expected) === false; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            unsubscribe();

            expect(seen).toContain(expected);
            expect((await books.invoices.where(([i, p]) => i.id === p.id, { id: invoice.id }).firstAsync()).balance).toBe(expected);
        });
    });

    describe('writing in bulk', () => {
        it('adds and removes many rows in one save', async () => {
            const before = await books.vendors.countAsync();
            const drafts = Array.from({ length: 25 }, (_, i) => ({
                name: `Bulk Vendor ${String(i).padStart(2, '0')}`, category: 'bulk', active: true,
            }));

            const added = await books.vendors.addAsync(...(drafts as never[]));
            await books.saveChangesAsync();

            expect(added).toHaveLength(25);
            expect(await books.vendors.countAsync()).toBe(before + 25);
            expect(await books.vendors.where(v => v.category === 'bulk').countAsync()).toBe(25);

            const bulk = await books.vendors.where(v => v.category === 'bulk').toArrayAsync();
            await books.vendors.removeAsync(...bulk);
            await books.saveChangesAsync();

            expect(await books.vendors.countAsync()).toBe(before);
        });
    });

    describe('two people editing the same invoice', () => {
        it('rejects the second writer instead of losing the first write', async () => {
            const name = `books-occ-${uuidv4()}`;
            const open = () => new Books(new ConcurrencyDbPlugin(new MemoryPlugin(name)));

            const setup = open();
            const [vendor] = await setup.vendors.addAsync({ name: 'Contested', category: 'facilities' } as never);
            await setup.saveChangesAsync();

            const writerA = open();
            const writerB = open();

            const a = await writerA.vendors.where(([v, p]) => v.id === p.id, { id: vendor.id }).firstAsync();
            const b = await writerB.vendors.where(([v, p]) => v.id === p.id, { id: vendor.id }).firstAsync();

            a.category = 'first';
            await writerA.saveChangesAsync();

            b.category = 'second';
            const error = await writerB.saveChangesAsync().then(() => null, e => e);

            expect(OptimisticConcurrencyError.is(error)).toBe(true);

            const settled = await open().vendors.where(([v, p]) => v.id === p.id, { id: vendor.id }).firstAsync();

            expect(settled.category).toBe('first');
        });

        it('lets the loser retry from a fresh read', async () => {
            const name = `books-occ-retry-${uuidv4()}`;
            const open = () => new Books(new ConcurrencyDbPlugin(new MemoryPlugin(name)));

            const setup = open();
            const [vendor] = await setup.vendors.addAsync({ name: 'Retried', category: 'facilities' } as never);
            await setup.saveChangesAsync();

            const writerA = open();
            const writerB = open();
            const a = await writerA.vendors.where(([v, p]) => v.id === p.id, { id: vendor.id }).firstAsync();
            const b = await writerB.vendors.where(([v, p]) => v.id === p.id, { id: vendor.id }).firstAsync();

            a.category = 'first';
            await writerA.saveChangesAsync();

            b.category = 'second';
            await writerB.saveChangesAsync().catch(() => undefined);

            const retry = open();
            const fresh = await retry.vendors.where(([v, p]) => v.id === p.id, { id: vendor.id }).firstAsync();

            fresh.category = 'second';
            await retry.saveChangesAsync();

            const settled = await open().vendors.where(([v, p]) => v.id === p.id, { id: vendor.id }).firstAsync();

            expect(settled.category).toBe('second');
        });
    });

    describe('attachments held as files', () => {
        it('takes content on write and gives back a reference on read', async () => {
            const bill = await books.bills.sort(b => b.amount).firstAsync();
            const bytes = new TextEncoder().encode('SCAN: rent, January, $1800.00');

            await books.receipts.addAsync({ billId: bill.id, label: 'Rent receipt', scan: bytes } as never);
            await books.saveChangesAsync();

            const [saved] = await books.receipts.where(r => r.label === 'Rent receipt').toArrayAsync();

            expect(saved.scan.size).toBe(bytes.byteLength);
            expect(saved.scan.checksum).toHaveLength(64);
            expect(saved.scan.key).toMatch(/^sha256\//);
            expect(await files.text(saved.scan)).toBe('SCAN: rent, January, $1800.00');
        });

        it('stores one copy of identical content', async () => {
            const bill = await books.bills.sort(b => b.amount).firstAsync();
            const bytes = new TextEncoder().encode('duplicate attachment');

            const [first] = await books.receipts.addAsync({ billId: bill.id, label: 'Copy A', scan: bytes } as never);
            const [second] = await books.receipts.addAsync({ billId: bill.id, label: 'Copy B', scan: bytes } as never);
            await books.saveChangesAsync();

            expect(first.scan.key).toBe(second.scan.key);
            expect(await files.text(second.scan)).toBe('duplicate attachment');
        });
    });

    describe('finding a similar item by embedding', () => {
        it('ranks the closest embedding first', async () => {
            const closest = await books.items.nearest(i => i.embedding, [1, 0, 0, 0], 2).toArrayAsync();

            expect(closest.map(i => i.sku)).toEqual(['CONSULT', 'SUPPORT']);
        });

        it('honours the requested count', async () => {
            expect(await books.items.nearest(i => i.embedding, [0, 1, 0, 0], 1).toArrayAsync()).toHaveLength(1);
            expect(await books.items.nearest(i => i.embedding, [0, 1, 0, 0], 99).toArrayAsync()).toHaveLength(3);
        });

        it('puts the exact match first whichever direction it is asked from', async () => {
            const widgetFirst = await books.items.nearest(i => i.embedding, [0, 1, 0, 0], 1).toArrayAsync();

            expect(widgetFirst[0].sku).toBe('WIDGET');
        });
    });

    describe('searching customer notes', () => {
        it('finds a customer by a word in their notes', async () => {
            const hits = await books.customers.search('timber').toArrayAsync();

            expect(hits.map(c => c.name).toSorted()).toEqual(['Beacon Foods', 'Delta Freight']);
        });

        it('requires every word by default', async () => {
            const hits = await books.customers.search('copper consulting').toArrayAsync();

            expect(hits.map(c => c.name)).toEqual(['Aurora Labs']);
        });

        it('matches any word when asked', async () => {
            const hits = await books.customers.search('copper timber', { match: 'any' }).toArrayAsync();

            expect(hits.length).toBeGreaterThan(2);
        });

        it('returns nothing for a word that appears nowhere', async () => {
            expect(await books.customers.search('zebra').toArrayAsync()).toEqual([]);
        });
    });

    describe('a property with its own serializer', () => {
        it('round-trips through the stored form', async () => {
            const aurora = await books.customers.where(c => c.code === 'CUS-001').firstAsync();

            expect(aurora.openingCents).toBe(1250.75);
        });

        it('filters on the value the caller wrote, not the stored one', async () => {
            const above = await books.customers.where(c => c.openingCents > 100).toArrayAsync();

            expect(above.map(c => c.code).toSorted()).toEqual(['CUS-001', 'CUS-004']);
        });
    });

    describe('the rest of the schema surface', () => {
        it('keeps a unique index on a distinct property', async () => {
            const codes = await books.customers.map(c => c.code).toArrayAsync();

            expect(new Set(codes).size).toBe(codes.length);
        });

        it('reads a tagged property like any other', async () => {
            const live = await books.customers.toArrayAsync();
            const west = await books.customers.where(c => c.region === 'west').countAsync();

            expect(west).toBe(live.filter(c => c.region === 'west').length);
            expect(west).toBeGreaterThan(0);
        });

        it('reads a readonly property', async () => {
            const aurora = await books.customers.where(c => c.code === 'CUS-001').firstAsync();

            expect(aurora.taxId).toBe('TX-AUR');
        });

        it('reads an optional property', async () => {
            const live = await books.customers.toArrayAsync();
            const withPhone = await books.customers.where(c => c.phone !== null).countAsync();

            expect(withPhone).toBe(live.length);
            expect(live.every(c => typeof c.phone === 'string')).toBe(true);
        });

        it('resolves a foreign key to a real account', async () => {
            const pairs = await books.items
                .join(x => x.accounts, item => item.incomeAccountId, account => account.id)
                .toArrayAsync();

            expect(pairs).toHaveLength(3);
            expect(pairs.every(([, account]) => account.kind === 'income')).toBe(true);
        });
    });

    describe('what the database was asked to do', () => {
        it('explains where each option ran', async () => {
            const { explanation } = await books.invoices
                .where(i => i.status === 'open')
                .sort(i => i.number)
                .take(5)
                .explain()
                .toArrayAsync();

            expect(explanation.collection).toBe('books_invoices');
            expect(explanation.summary.database + explanation.summary.memory).toBeGreaterThan(0);
        });
    });
});
