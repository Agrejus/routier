import { faker } from '@faker-js/faker';
import { InferCreateType } from '@routier/core/schema';
import { orderSchema, REGIONS, STATUSES } from './schemas';

/**
 * Seeded faker, so every database receives the exact same orders and every
 * query returns the exact same answers on every engine.
 */
export function makeOrders(count: number): InferCreateType<typeof orderSchema>[] {
    faker.seed(42);
    const orders: InferCreateType<typeof orderSchema>[] = [];

    for (let i = 0; i < count; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        orders.push({
            customer: `${firstName} ${lastName}`,
            // The row index keeps emails unique across 25k rows; faker alone collides.
            email: faker.internet.email({ firstName, lastName }).toLowerCase().replace('@', `.${i}@`),
            status: faker.helpers.arrayElement(STATUSES),
            region: faker.helpers.arrayElement(REGIONS),
            total: faker.number.float({ min: 1, max: 999, fractionDigits: 2 }),
            items: faker.number.int({ min: 1, max: 12 }),
            createdAt: faker.date.between({ from: '2024-01-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }),
        });
    }
    return orders;
}
