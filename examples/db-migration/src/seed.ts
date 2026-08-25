import { faker } from '@faker-js/faker';
import { InferCreateType } from '@routier/core/schema';
import { CARRIERS, CATEGORIES, REGIONS, STATUSES, orderSchema } from './schemas';

/**
 * Seeded faker, so every database receives the exact same rows and every query returns the
 * exact same answers on every engine.
 *
 * The share each collection takes of the total is fixed, so a dataset of any size is split the
 * same way. `orders` keeps the largest share because the benchmark's query suite runs against
 * it, and comparing engines needs the rows to be somewhere they are actually read.
 */
const SHARE: Record<string, number> = {
    orders: 0.40,
    products: 0.15,
    customers: 0.15,
    invoices: 0.12,
    shipments: 0.09,
    suppliers: 0.05,
    reviews: 0.04,
};

export type SeedRows = Record<string, Record<string, unknown>[]>;

/** How many rows each collection gets, summing to exactly `total`. */
export function seedCounts(total: number): Record<string, number> {
    const names = Object.keys(SHARE);
    const counts: Record<string, number> = {};
    let assigned = 0;

    for (const name of names.slice(0, -1)) {
        counts[name] = Math.round(total * SHARE[name]);
        assigned += counts[name];
    }

    // The last one takes the remainder, so rounding never loses or invents a row.
    counts[names[names.length - 1]] = Math.max(0, total - assigned);

    return counts;
}

export function makeSeed(total: number): SeedRows {
    faker.seed(42);
    const counts = seedCounts(total);

    return {
        orders: build(counts.orders, i => {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();

            return {
                customer: `${firstName} ${lastName}`,
                // The row index keeps emails unique across 25k rows; faker alone collides.
                email: faker.internet.email({ firstName, lastName }).toLowerCase().replace('@', `.${i}@`),
                status: faker.helpers.arrayElement(STATUSES),
                region: faker.helpers.arrayElement(REGIONS),
                total: faker.number.float({ min: 1, max: 999, fractionDigits: 2 }),
                items: faker.number.int({ min: 1, max: 12 }),
                createdAt: faker.date.between({ from: '2024-01-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }),
            };
        }),
        products: build(counts.products, i => ({
            name: faker.commerce.productName(),
            sku: `SKU-${i.toString().padStart(6, '0')}`,
            category: faker.helpers.arrayElement(CATEGORIES),
            price: faker.number.float({ min: 1, max: 499, fractionDigits: 2 }),
            inStock: faker.number.int({ min: 0, max: 500 }),
        })),
        customers: build(counts.customers, i => {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();

            return {
                name: `${firstName} ${lastName}`,
                email: faker.internet.email({ firstName, lastName }).toLowerCase().replace('@', `.c${i}@`),
                country: faker.location.country(),
                joinedAt: faker.date.between({ from: '2020-01-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }),
                lifetimeValue: faker.number.float({ min: 0, max: 25000, fractionDigits: 2 }),
            };
        }),
        invoices: build(counts.invoices, i => ({
            number: `INV-${i.toString().padStart(6, '0')}`,
            amount: faker.number.float({ min: 10, max: 9999, fractionDigits: 2 }),
            paid: faker.datatype.boolean(),
            issuedAt: faker.date.between({ from: '2024-01-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }),
        })),
        shipments: build(counts.shipments, () => ({
            tracking: faker.string.alphanumeric({ length: 12, casing: 'upper' }),
            carrier: faker.helpers.arrayElement(CARRIERS),
            delivered: faker.datatype.boolean(),
            shippedAt: faker.date.between({ from: '2024-01-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }),
        })),
        suppliers: build(counts.suppliers, () => ({
            name: faker.company.name(),
            country: faker.location.country(),
            leadTimeDays: faker.number.int({ min: 1, max: 90 }),
        })),
        reviews: build(counts.reviews, () => ({
            author: faker.person.fullName(),
            rating: faker.number.int({ min: 1, max: 5 }),
            body: faker.lorem.sentence(),
        })),
    };
}

const build = <T>(count: number, make: (index: number) => T): T[] =>
    Array.from({ length: count }, (_, index) => make(index));

/**
 * Exactly `count` orders and nothing else, for the query inspector.
 *
 * Not `makeSeed(count).orders`, which returns the orders' *share* of a total — 40% of it. The
 * inspector asks for a number of orders and has to get that number, or a query that pages past
 * the first thousand rows silently returns nothing.
 */
export function makeOrdersOnly(count: number): InferCreateType<typeof orderSchema>[] {
    faker.seed(42);

    return build(count, i => {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        return {
            customer: `${firstName} ${lastName}`,
            email: faker.internet.email({ firstName, lastName }).toLowerCase().replace('@', `.${i}@`),
            status: faker.helpers.arrayElement(STATUSES),
            region: faker.helpers.arrayElement(REGIONS),
            total: faker.number.float({ min: 1, max: 999, fractionDigits: 2 }),
            items: faker.number.int({ min: 1, max: 12 }),
            createdAt: faker.date.between({ from: '2024-01-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }),
        };
    });
}
