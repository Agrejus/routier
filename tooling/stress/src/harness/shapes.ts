import { shapeCatalog } from '@routier/test-utils';

/**
 * The entity shapes the workloads are driven with.
 *
 * These live in the harness rather than in the scenario that first needed them, for a
 * mechanical reason: S8 runs the same loads against Postgres, and importing them from
 * `s1-volume-single-collection.test.ts` would execute that file's `describe` and `afterEach`
 * registrations inside S8's module scope. Jest would then run S1 twice, once with the wrong
 * teardown. A shape shared between scenarios has to be somewhere neither of them owns.
 *
 * Each shape keeps its callbacks together on purpose. `mutate` writes exactly the fields
 * `snapshot` copies and `fields` compares; changing one without the others silently stops
 * checking something, and nothing fails to say so.
 */

// ---------------------------------------------------------------------------
// Products — the volume shape
// ---------------------------------------------------------------------------

export type Product = { _id: string; name: string; category: string; price: number };

/**
 * Deterministic product content, so a divergence names a specific generated row.
 *
 * A factory rather than a function, because the counter must not be shared between runs: two
 * scenarios drawing from one sequence would produce different content on the second run of
 * either, and a seeded scenario that is not reproducible is the one thing this suite cannot
 * tolerate.
 */
export const productFactory = () => {
    let nextValue = 0;

    return () => {
        const n = nextValue++;
        return {
            name: `product-${n}`,
            category: `category-${n % 25}`,
            price: n % 1000,
        };
    };
};

export const productShape = {
    keyOf: (product: Product) => product._id,
    /** A plain snapshot, detached from whatever proxy the store handed back. */
    snapshot: (product: Product): Product => ({
        _id: product._id,
        name: product.name,
        category: product.category,
        price: product.price,
    }),
    fields: ['name', 'category', 'price'] as const,
    mutate: (product: Product, batch: number) => {
        product.price = 10_000 + batch;
        product.category = `churned-${batch}`;
    },
};

// ---------------------------------------------------------------------------
// Churned entities — the churn shape
// ---------------------------------------------------------------------------

export type Churned = {
    id: string;
    text: string | null;
    count?: number;
    nested: { value: string };
    values: string[];
};

/**
 * `multi-mixed-modifiers` — a scalar, a depth-1 nested object, and an array in one shape,
 * plus nullable/optional/default/renamed modifiers along for the ride.
 *
 * It is also the one catalog shape the churn load can drive end to end: `object-depth-3` trips
 * defect #13 and `array-of-date` trips #12. Both are pinned in S2, and re-tripping them here
 * would only re-report a known gap while destroying a scenario's ability to find anything else.
 */
export const churnShapeCase = () => {
    const found = shapeCatalog().find((c: any) => c.spec.name === 'multi-mixed-modifiers' && c.order === 'key-first');

    if (found == null) {
        throw new Error('Shape catalog has no case "multi-mixed-modifiers [key-first]"');
    }

    return found;
};

export const churnShape = {
    keyOf: (entity: Churned) => entity.id,
    snapshot: (entity: Churned): Churned => ({
        id: entity.id,
        text: entity.text,
        count: entity.count,
        nested: { value: entity.nested.value },
        values: [...entity.values],
    }),
    fields: ['text', 'count', 'nested', 'values'] as const,
    seedEntity: (i: number) => ({
        id: `churn-${i}`,
        text: `text-${i}`,
        count: i,
        at: new Date(Date.UTC(2020, 0, 1 + (i % 28))),
        nested: { value: `n${i}` },
        values: [`a${i}`, `b${i}`],
    }),
    mutate: (entity: Churned, generation: number) => {
        entity.text = `text-gen${generation}`;
        entity.nested.value = `nested-gen${generation}`;
        // Whole-array replacement, not `values[0] = ...`. In-place element writes stop being
        // tracked after the entity's first merge (defect #12, pinned in S2); using them here
        // would silently drop the edit and report the oracle mismatch as a new finding.
        entity.values = [`gen${generation}`, `b-${entity.id}`];
    },
    readdEntity: (removed: Churned, generation: number) => ({
        id: removed.id,
        text: `text-readd${generation}`,
        count: generation,
        at: new Date(Date.UTC(2021, 0, 1 + (generation % 28))),
        nested: { value: `nested-readd${generation}` },
        values: [`readd${generation}`],
    }),
};
