import { InferCreateType } from '@routier/core/schema';
import { orderSchema, REGIONS, STATUSES } from './schemas';

const FIRST = ['James', 'Maria', 'Wei', 'Priya', 'Liam', 'Sofia', 'Noah', 'Amara', 'Kenji', 'Elena'];
const LAST = ['DeMeuse', 'Garcia', 'Chen', 'Patel', 'Olson', 'Rossi', 'Kim', 'Okafor', 'Tanaka', 'Novak'];

/** Deterministic PRNG so every database seeds the exact same 25k orders. */
function mulberry32(seed: number) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function makeOrders(count: number): InferCreateType<typeof orderSchema>[] {
    const rand = mulberry32(42);
    const orders: InferCreateType<typeof orderSchema>[] = [];
    const start = Date.UTC(2024, 0, 1);
    const span = Date.UTC(2026, 7, 1) - start;

    for (let i = 0; i < count; i++) {
        const first = FIRST[Math.floor(rand() * FIRST.length)];
        const last = LAST[Math.floor(rand() * LAST.length)];
        orders.push({
            customer: `${first} ${last}`,
            email: `${first}.${last}${i}@example.com`.toLowerCase(),
            status: STATUSES[Math.floor(rand() * STATUSES.length)],
            region: REGIONS[Math.floor(rand() * REGIONS.length)],
            total: Math.round(rand() * 99900 + 100) / 100,
            items: Math.floor(rand() * 12) + 1,
            createdAt: new Date(start + Math.floor(rand() * span)),
        });
    }
    return orders;
}
