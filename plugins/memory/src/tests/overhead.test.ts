import { afterAll, describe, expect, it } from '@jest/globals';
import { logger, uuidv4 } from '@routier/core';
import { InferType, s } from '@routier/core/schema';
import { toExpression } from '@routier/core/expressions';
import { Query, QueryOptionsCollection } from '@routier/core/plugins';
import { SchemaCollection } from '@routier/core/collections';
import { PluginEventResult } from '@routier/core/results';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';

/**
 * Measures what the datastore layer itself costs, per query and per entity.
 *
 * The baseline dispatches a query event directly at the plugin — that is the storage cost.
 * The same query through the datastore adds everything Routier does on top: expression
 * parsing, the queryable pipeline, deserialization, and change tracking. The difference is
 * Routier's overhead, which these tests bound and print.
 *
 * Bounds are deliberately loose (CI machines vary); the printed numbers are the deliverable.
 */

const rowSchema = s.define("overhead_rows", {
    _id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
}).compile();

class OverheadStore extends DataStore {
    rows = this.collection(rowSchema).proxy().create();
}

type Row = InferType<typeof rowSchema>;

const ROWS = 10_000;
const RUNS = 15;

const median = (samples: number[]): number => {
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

const measure = async (fn: () => Promise<unknown>): Promise<number> => {
    for (let i = 0; i < 3; i++) {
        await fn();
    }

    const samples: number[] = [];

    for (let i = 0; i < RUNS; i++) {
        const start = performance.now();
        await fn();
        samples.push(performance.now() - start);
    }

    return median(samples);
};

describe("datastore overhead over the raw plugin", () => {

    const plugin = new MemoryPlugin(`overhead-${uuidv4()}`);
    const store = new OverheadStore(plugin);
    const schemas = new SchemaCollection();
    schemas.set(rowSchema.id, rowSchema);

    afterAll(async () => {
        await store.destroyAsync();
    });

    const seeded = (async () => {
        const rows = Array.from({ length: ROWS }, (_, i) => ({
            name: `row-${i}`,
            price: i % 1_000,
            category: i % 2 === 0 ? "even" : "odd",
        }));

        await store.rows.addAsync(...rows);
        await store.saveChangesAsync();
    })();

    /** The same read the datastore issues, sent straight at the plugin. */
    const queryPluginDirectly = (filter: (row: Row) => boolean) => {
        const options = new QueryOptionsCollection<Row>();

        options.add("filter", {
            filter,
            expression: toExpression(rowSchema, filter),
            params: undefined,
        });

        return new Promise<unknown>((resolve, reject) => {
            plugin.query({
                id: uuidv4(),
                schemas,
                source: "overhead-test",
                action: "query",
                explain: false,
                executedQueries: [],
                operation: new Query(options, rowSchema, false),
            }, result => {
                if (result.ok === PluginEventResult.ERROR) {
                    reject(result.error);
                    return;
                }

                resolve(result.data);
            });
        });
    };

    it("bounds the per-entity cost of the full pipeline over a wide read", async () => {
        await seeded;

        const matched = ROWS / 2;
        const raw = await measure(() => queryPluginDirectly(row => row.price < 500));
        const tracked = await measure(() => store.rows.where(([row, p]) => row.price < p.max, { max: 500 }).toArrayAsync());
        const perEntityMicros = ((tracked - raw) / matched) * 1_000;

        logger.log(
            `wide read, ${matched} of ${ROWS} rows — plugin alone: ${raw.toFixed(2)}ms, ` +
            `through datastore: ${tracked.toFixed(2)}ms, overhead: ${perEntityMicros.toFixed(2)}µs/entity`
        );

        expect(perEntityMicros).toBeLessThan(25);
    });

    it("bounds the fixed per-query cost with a narrow read", async () => {
        await seeded;

        const narrow = await measure(() => store.rows.where(([row, p]) => row.price === p.price, { price: 1 }).toArrayAsync());

        logger.log(`narrow read, 10 of ${ROWS} rows — full round trip: ${narrow.toFixed(2)}ms`);

        expect(narrow).toBeLessThan(10);
    });

    it("bounds what .explain() adds to a query", async () => {
        await seeded;

        const plain = await measure(() => store.rows.where(([row, p]) => row.price < p.max, { max: 500 }).toArrayAsync());
        const explained = await measure(() => store.rows.where(([row, p]) => row.price < p.max, { max: 500 }).explain().toArrayAsync());
        const added = explained - plain;

        logger.log(`explain off: ${plain.toFixed(2)}ms, explain on: ${explained.toFixed(2)}ms, added: ${added.toFixed(2)}ms`);

        expect(added).toBeLessThan(5);
    });
});
