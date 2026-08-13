/**
 * A seeded pseudo-random generator.
 *
 * `Math.random` is unusable here: a stress failure that cannot be replayed is a rumour,
 * not a defect. Every scenario draws from one of these, seeded from a constant that the
 * failure banner prints, so re-running the file reproduces the exact sequence of batch
 * sizes, mutation targets, and interleavings that broke it.
 *
 * mulberry32 — 32-bit state, one multiply-xorshift round. Chosen for being short enough
 * to audit at a glance and stable across Node versions, not for statistical strength.
 */
export class Rng {
    private state: number;

    constructor(readonly seed: number) {
        this.state = seed >>> 0;
    }

    /** A float in [0, 1). */
    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** An integer in [0, maxExclusive). */
    int(maxExclusive: number): number {
        return Math.floor(this.next() * maxExclusive);
    }

    /** An integer in [min, max] inclusive on both ends. */
    between(min: number, max: number): number {
        return min + this.int(max - min + 1);
    }

    /** True with the given probability. */
    chance(probability: number): boolean {
        return this.next() < probability;
    }

    pick<T>(items: readonly T[]): T {
        return items[this.int(items.length)];
    }

    /**
     * `count` distinct members of `items`, or all of them when the pool is smaller.
     *
     * Partial Fisher-Yates over a copy: rejection sampling would degrade badly once
     * `count` approaches `items.length`, which is exactly what the churn scenario does.
     */
    sample<T>(items: readonly T[], count: number): T[] {
        const pool = [...items];
        const take = Math.min(count, pool.length);

        for (let i = 0; i < take; i++) {
            const j = i + this.int(pool.length - i);
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        return pool.slice(0, take);
    }
}
