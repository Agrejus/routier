import { afterAll, afterEach, expect } from '@jest/globals';
import { CompiledSchema } from '@routier/core';
import { DataStore } from '@routier/datastore';
import { shapeCatalog } from '@routier/test-utils';
import {
    Backend,
    RICH_BACKENDS,
    cleanupBackendArtifacts,
    stressDescribe,
    stressIt,
} from './harness';

/**
 * S2 — wide schemas and deep nesting, at volume.
 *
 * S1 holds the shape flat and varies the count. This holds the count high and varies the
 * shape, because the codegen pipeline is where shape actually costs something: enrich,
 * serialize, clone, and the change-tracking proxies are all generated per schema, and
 * three of the ten fixed defects in specs/known-defects.md were shape-sensitive bugs in
 * exactly that generated code — subtrees hoisted to the root at depth 2+, Dates destroyed
 * inside arrays, nested mutations not marked dirty.
 *
 * Those were found and fixed on single entities. What no functional test covers is
 * whether the same generated handlers still hold after ten thousand executions with ten
 * thousand distinct values flowing through them. A handler that mutates state it should
 * only read, or a cache keyed on something that collides, will pass at n=1 and drift at
 * n=10,000.
 *
 * Three shapes from the catalog, chosen for what each one can break:
 *
 *  - `object-depth-3` — the deepest nesting the catalog has, and the shape that caught the
 *    root-hoisting defect. Its mutation goes three levels down through the proxy.
 *  - `multi-mixed-modifiers` — every modifier at once (nullable, optional, default,
 *    renamed, nested, array) in one declaration order. Modifiers interact through shared
 *    generated code; this is where that interaction shows.
 *  - `array-of-date` — the shape that caught clone-destroys-Dates-in-arrays. Dates are the
 *    one type that can survive a round trip while ceasing to be a Date.
 *
 * Backends: rich-type backends only. SQLite has no boolean, date, array, or object column
 * type and declines rich types in its own contract run, so running it here would measure a
 * documented storage limitation rather than a Routier defect.
 */

const ENTITIES_PER_SHAPE = 10_000;
const SHAPE_NAMES = ['object-depth-3', 'multi-mixed-modifiers', 'array-of-date'] as const;

/**
 * One order per shape rather than all four.
 *
 * The catalog compiles every shape in four key positions, and order genuinely matters to
 * codegen — but four orders x three shapes x 10k entities x two backends does not fit the
 * 5-minute per-file budget. `key-first` is the order real schemas are written in.
 * Order sensitivity is already covered exhaustively at n=1 by generatorInvariants.
 */
const ORDER = 'key-first';

const shapeCase = (name: string) => {
    const found = shapeCatalog().find(c => c.spec.name === name && c.order === ORDER);

    if (found == null) {
        throw new Error(`Shape catalog has no case "${name} [${ORDER}]"`);
    }

    return found;
};

class ShapeStore extends DataStore {
    entities: any;

    constructor(plugin: any, schema: CompiledSchema<any>) {
        super(plugin);
        this.entities = this.collection(schema).create();
    }
}

const stores: ShapeStore[] = [];

const openStore = (backend: Backend, schema: CompiledSchema<any>) => {
    const store = new ShapeStore(backend.create(), schema);
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

afterAll(cleanupBackendArtifacts);

/** True for anything that behaves like a Date, including one from a foreign realm. */
const isDateLike = (value: unknown) =>
    value != null && typeof (value as any).getTime === 'function' &&
    Number.isNaN((value as Date).getTime()) === false;

/**
 * Every key path in an object, sorted.
 *
 * Comparing key *sets* rather than values is what catches silent property omission: a
 * codegen path that drops `nested.inner.deepest` still returns a well-formed entity that
 * passes every value assertion aimed at the properties it kept.
 */
const keyPaths = (value: unknown, prefix = ''): string[] => {
    if (value == null || typeof value !== 'object' || Array.isArray(value) || isDateLike(value)) {
        return [prefix];
    }

    return Object.keys(value as object)
        // `__tracking__` is the change tracker's own bookkeeping, installed as a
        // non-enumerable property on tracked entities. It is not part of the shape.
        .filter(key => key !== '__tracking__')
        .flatMap(key => keyPaths((value as any)[key], prefix === '' ? key : `${prefix}.${key}`))
        .sort();
};

/** Per-shape generation and mutation. The catalog gives schemas, not values. */
type ShapeDriver = {
    /** Values for entity `i`. Deterministic in `i` so a failure names a specific row. */
    readonly make: (i: number) => Record<string, any>;
    /** Mutates a tracked entity through its proxy. */
    readonly mutate: (entity: any, i: number) => void;
    /** Reads back what `mutate` wrote, for the persistence assertion. */
    readonly read: (entity: any) => unknown;
    /** What `read` should return after `mutate(entity, i)`. */
    readonly expected: (i: number) => unknown;
};

const DRIVERS: Record<(typeof SHAPE_NAMES)[number], ShapeDriver> = {
    'object-depth-3': {
        make: i => ({ id: `d3-${i}`, nested: { inner: { deepest: { value: `v${i}` } } } }),
        // Three levels through the proxy. Defect #2 was that exactly this left the entity
        // clean, so the edit was discarded at save time with no error.
        mutate: (entity, i) => { entity.nested.inner.deepest.value = `mutated-${i}`; },
        read: entity => entity.nested?.inner?.deepest?.value,
        expected: i => `mutated-${i}`,
    },
    'multi-mixed-modifiers': {
        make: i => ({
            id: `mm-${i}`,
            text: i % 7 === 0 ? null : `text-${i}`,
            count: i % 5 === 0 ? undefined : i,
            // `flag` is omitted on purpose: it carries default(false), and a default that
            // is falsy is the case a truthiness check silently gets wrong.
            at: new Date(Date.UTC(2020, 0, 1 + (i % 28))),
            nested: { value: `n${i}` },
            values: [`a${i}`, `b${i}`],
        }),
        // An in-place array write plus a nested scalar write in one edit: array mutation
        // and object mutation take different tracking paths.
        mutate: (entity, i) => {
            entity.values[0] = `mutated-${i}`;
            entity.nested.value = `mutated-${i}`;
        },
        read: entity => `${entity.values?.[0]}|${entity.nested?.value}`,
        expected: i => `mutated-${i}|mutated-${i}`,
    },
    'array-of-date': {
        make: i => ({
            id: `ad-${i}`,
            values: [new Date(Date.UTC(2021, 0, 1 + (i % 28))), new Date(Date.UTC(2022, 0, 1 + (i % 28)))],
        }),
        mutate: (entity, i) => { entity.values[0] = new Date(Date.UTC(2030, 0, 1 + (i % 28))); },
        read: entity => (isDateLike(entity.values?.[0]) ? (entity.values[0] as Date).getTime() : `not-a-date: ${String(entity.values?.[0])}`),
        expected: i => Date.UTC(2030, 0, 1 + (i % 28)),
    },
};

/** Reports the first failing entity rather than dumping ten thousand of them. */
const firstFailure = <T>(items: readonly T[], predicate: (item: T, index: number) => string | null) => {
    for (let i = 0; i < items.length; i++) {
        const failure = predicate(items[i], i);
        if (failure != null) {
            return `entity ${i}: ${failure}`;
        }
    }
    return null;
};

/**
 * Shapes this scenario cannot complete yet, and the defect that stops each.
 *
 * Both were found by this scenario, reduced to a single entity, and recorded in
 * specs/known-defects.md. Pinning them here rather than deleting the cases keeps the
 * coverage: the day either defect is fixed, its case fails "because it passed" and this
 * table has to be updated, instead of the scenario quietly never being re-enabled.
 *
 * `multi-mixed-modifiers` is deliberately absent — it mutates a nested scalar as well as
 * an array element, and the nested write alone is enough to mark the entity dirty, so it
 * still runs end to end and guards everything the other two cannot reach.
 */
// Defects #12 (array proxy lost on merge) and #13 (deep delta serialization) are fixed;
// every shape runs end to end. Empty until a new defect earns a row.
const KNOWN_FAILING: Partial<Record<(typeof SHAPE_NAMES)[number], number>> = {};

stressDescribe('S2 volume: wide schemas and deep nesting', () => {
    for (const backend of RICH_BACKENDS) {
        const count = Math.min(ENTITIES_PER_SHAPE, backend.volumeBudget);

        for (const shapeName of SHAPE_NAMES) {
            stressIt(
                `${backend.name}/${shapeName}: ${count.toLocaleString('en-US')} full lifecycles preserve shape and value`,
                {
                    seed: 20260802,
                    scale: { backend: backend.name, shape: shapeName, entities: count, order: ORDER },
                    knownFailing: KNOWN_FAILING[shapeName],
                },
                async ({ note }) => {
                    const driver = DRIVERS[shapeName];
                    const { schema } = shapeCase(shapeName);
                    const store = openStore(backend, schema);

                    // ---- add ------------------------------------------------------
                    await store.entities.addAsync(...Array.from({ length: count }, (_, i) => driver.make(i)));
                    await store.saveChangesAsync();

                    expect(await store.entities.countAsync()).toBe(count);

                    // ---- read back ------------------------------------------------
                    const loaded: any[] = await store.entities.toArrayAsync();

                    expect(loaded.length).toBe(count);

                    // The key set of the very first entity is the reference every later
                    // read is measured against. Taking it from the data rather than from
                    // the schema means a property the schema declares but codegen never
                    // emits does not quietly become the expectation.
                    const referenceKeys = keyPaths(loaded[0]).join(',');

                    note(`reference key paths: ${referenceKeys}`);

                    const afterLoad = firstFailure(loaded, entity => {
                        const keys = keyPaths(entity).join(',');
                        return keys === referenceKeys ? null : `key set drifted to [${keys}]`;
                    });

                    expect(afterLoad ?? 'stable').toBe('stable');

                    // ---- mutate through the tracked proxy -------------------------
                    const byIndex = new Map<any, number>();
                    loaded.forEach((entity, i) => {
                        byIndex.set(entity, i);
                        driver.mutate(entity, i);
                    });

                    const saved = await store.saveChangesAsync();

                    // Every mutation must have been *seen*. A tracking path that misses
                    // nested or array writes reports fewer updates and loses the edits
                    // without raising anything.
                    expect(saved.aggregate.updates).toBe(count);

                    // ---- read back again ------------------------------------------
                    const reloaded: any[] = await store.entities.toArrayAsync();

                    expect(reloaded.length).toBe(count);

                    // Reload order is the backend's business, so mutations are checked by
                    // the id the driver encoded rather than by position.
                    const expectedByRead = new Map(
                        Array.from({ length: count }, (_, i) => [driver.make(i).id as string, driver.expected(i)])
                    );

                    const persisted = firstFailure(reloaded, entity => {
                        const expectedValue = expectedByRead.get(entity.id);

                        if (expectedValue === undefined) {
                            return `unknown id "${entity.id}" in the reloaded set`;
                        }

                        const actual = driver.read(entity);

                        return actual === expectedValue
                            ? null
                            : `id ${entity.id}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`;
                    });

                    expect(persisted ?? 'all mutations persisted').toBe('all mutations persisted');

                    const shapeStable = firstFailure(reloaded, entity => {
                        const keys = keyPaths(entity).join(',');
                        return keys === referenceKeys ? null : `key set drifted to [${keys}]`;
                    });

                    expect(shapeStable ?? 'stable').toBe('stable');
                }
            );
        }
    }

    // Dates get their own assertion rather than riding along in the driver, because the
    // failure mode is specifically "still equal, no longer a Date" — a value that passes
    // every equality check and then throws the first time something calls `.getFullYear()`.
    for (const backend of RICH_BACKENDS) {
        const count = Math.min(ENTITIES_PER_SHAPE, backend.volumeBudget);

        stressIt(
            `${backend.name}: dates inside arrays stay date-like across ${count.toLocaleString('en-US')} round trips`,
            { seed: 20260802, scale: { backend: backend.name, shape: 'array-of-date', entities: count, order: ORDER } },
            async ({ note }) => {
                const driver = DRIVERS['array-of-date'];
                const store = openStore(backend, shapeCase('array-of-date').schema);

                await store.entities.addAsync(...Array.from({ length: count }, (_, i) => driver.make(i)));
                await store.saveChangesAsync();

                for (let round = 0; round < 3; round++) {
                    const loaded: any[] = await store.entities.toArrayAsync();

                    const failure = firstFailure(loaded, entity => {
                        if (Array.isArray(entity.values) === false) {
                            return `values is not an array: ${JSON.stringify(entity.values)}`;
                        }

                        const bad = entity.values.findIndex((v: unknown) => isDateLike(v) === false);

                        return bad === -1
                            ? null
                            // `instanceof Date` is deliberately not the check: inside Jest a
                            // value that crossed a realm fails it while being a perfectly
                            // good Date. Duck-typing on getTime is the documented workaround.
                            : `values[${bad}] is not date-like (${Object.prototype.toString.call(entity.values[bad])})`;
                    });

                    if (failure != null) {
                        note(`round ${round} of 3`);
                    }

                    expect(failure ?? 'all date-like').toBe('all date-like');

                    // Re-save unchanged. A clone or serialize path that degrades Dates does
                    // it on the write, so the damage only appears on the round trip after.
                    await store.saveChangesAsync();
                }
            }
        );
    }
});
