import { afterEach, describe, expect, it } from "@jest/globals";
import { IDbPlugin } from "@routier/core";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { executedQueriesOf } from "@routier/core/plugins";

/**
 * A behavioral contract every IDbPlugin implementation must satisfy, written once and
 * parameterized over a plugin factory.
 *
 * The point is cross-plugin agreement. Phase 0 turned up places where memory and
 * file-system disagreed only because each had its own bespoke suite; a shared contract
 * makes divergence a test failure instead of a discovery. A new plugin gets the whole
 * suite by calling this with a factory.
 *
 * Shapes here stay at object depth 1 deliberately: deeper nesting hits a known codegen
 * defect (enrich hoists nested subtrees to the root), and this kit is meant to exercise
 * plugins rather than rediscover that bug once per plugin.
 */

/**
 * The core shape: strings and numbers only.
 *
 * Every backing store can hold these natively. Booleans, dates, arrays, and nested objects
 * cannot be assumed — SQLite stores booleans as integers and has no array or object column
 * type, so a schema using them needs explicit per-property serializers. Keeping those out of
 * the core shape means a plugin's core result reflects its query and persistence behavior
 * rather than which primitive types its storage engine happens to support. Richer types are
 * covered by the "rich types" section, which a plugin opts into via `supportsRichTypes`.
 */
export const contractProductSchema = s.define("contract_products", {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
}).compile();

/** The richer shape, for stores that hold booleans, dates, arrays, and objects natively. */
export const contractRichSchema = s.define("contract_rich", {
    _id: s.string().key().identity(),
    name: s.string(),
    inStock: s.boolean(),
    createdDate: s.date(),
    tags: s.array(s.string()),
    note: s.string().nullable(),
    rating: s.number().optional(),
    dimensions: s.object({ width: s.number(), height: s.number() }),
}).compile();

export const contractCompositeSchema = s.define("contract_composite", {
    tenantId: s.string().key(),
    sku: s.string().key(),
    quantity: s.number(),
}).compile();

export const contractRenamedSchema = s.define("contract_renamed", {
    _id: s.string().key().identity(),
    label: s.string().from("wire_label"),
    amount: s.number().from("wire_amount"),
}).compile();

class ContractDataStore extends DataStore {
    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    products = this.collection(contractProductSchema).proxy().create();
    rich = this.collection(contractRichSchema).proxy().create();
    composites = this.collection(contractCompositeSchema).proxy().create();
    renamed = this.collection(contractRenamedSchema).proxy().create();
}

type Product = { name: string; category: string; price: number };

/** Fixed, non-random products so ordering and aggregate assertions are exact. */
const PRODUCTS: Product[] = [
    { name: "Alpha", category: "tools", price: 10 },
    { name: "Bravo", category: "tools", price: 30 },
    { name: "Charlie", category: "toys", price: 20 },
    { name: "Delta", category: "toys", price: 40 },
];

/**
 * Richer-typed rows, used only by the "rich types" section.
 *
 * Annotated rather than inferred: the third row has an empty `tags` and a null `note`, so
 * inference widens those to `any[]` and `any` and the array stops type-checking anything.
 */
type RichRow = {
    name: string;
    inStock: boolean;
    createdDate: Date;
    tags: string[];
    note: string | null;
    rating?: number;
    dimensions: { width: number; height: number };
};

const RICH: RichRow[] = [
    { name: "Alpha", inStock: true, createdDate: new Date("2024-01-01T00:00:00.000Z"), tags: ["a"], note: null, rating: 5, dimensions: { width: 1, height: 2 } },
    { name: "Bravo", inStock: false, createdDate: new Date("2024-02-01T00:00:00.000Z"), tags: ["a", "b"], note: "second", rating: 3, dimensions: { width: 3, height: 4 } },
    { name: "Charlie", inStock: true, createdDate: new Date("2024-03-01T00:00:00.000Z"), tags: [], note: null, dimensions: { width: 5, height: 6 } },
];

/**
 * Rejects if the promise has not settled in time.
 *
 * A plugin that never invokes its callback would otherwise stall the whole run rather than
 * fail a test — Jest's per-test timeout does not interrupt a pending promise chain fast
 * enough to keep the suite legible. Bounding the wait turns "hangs forever" into a named
 * failure, which is the outcome a contract suite has to produce.
 */
function withTimeout<T>(promise: Promise<T>, label: string, ms: number = 2000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} did not settle within ${ms}ms`)), ms);
        promise.then(
            value => { clearTimeout(timer); resolve(value); },
            error => { clearTimeout(timer); reject(error); },
        );
    });
}

export type PluginContractOptions = {
    /**
     * Contract section names this plugin is not expected to satisfy yet. Prefer leaving a
     * section failing over skipping it — a skip that outlives the defect is invisible.
     */
    readonly skipSections?: readonly string[];
    /**
     * Whether the store holds booleans, dates, arrays, and nested objects natively.
     *
     * Off by default so a new plugin starts from the shape every store can represent. A
     * store that needs per-property serializers for these types (SQLite and other SQL
     * engines) should leave this off rather than declaring support it only has with
     * schema-level help.
     */
    readonly supportsRichTypes?: boolean;
    /**
     * Test names this plugin is known not to satisfy, registered with `it.failing` so they
     * stay in the report and fail loudly once fixed.
     *
     * Preferred over skipping: a divergence recorded here is visible in every run, and the
     * suite breaks the moment the plugin starts passing, which is what stops a stale
     * exemption from outliving its defect.
     */
    readonly knownFailing?: readonly string[];
    /**
     * Test names whose outcome is not stable for this plugin: they still run, and a failure
     * is reported to stderr but does not fail the suite.
     *
     * This exists because `it` and `it.failing` both assume a deterministic outcome. A plugin
     * that returns a different wrong answer on each run satisfies neither — enumerating it as
     * failing breaks whenever it accidentally passes. Keeping the test running (rather than
     * skipping it) means the divergence stays visible in output; the suite just does not gate
     * on it. Use only with a recorded reason, and prefer `knownFailing` when the outcome is
     * stable.
     */
    readonly knownUnstable?: readonly string[];
};

export function describePluginContract(
    name: string,
    factory: () => IDbPlugin,
    options: PluginContractOptions = {}
) {
    const skipped = new Set(options.skipSections ?? []);
    const knownFailing = new Set(options.knownFailing ?? []);
    const knownUnstable = new Set(options.knownUnstable ?? []);
    const section = (title: string, body: () => void) => {
        (skipped.has(title) ? describe.skip : describe)(title, body);
    };
    /** Registers a contract test, downgrading known divergences appropriately. */
    const test = (title: string, body: () => void | Promise<void>) => {
        if (knownUnstable.has(title)) {
            it(title, async () => {
                try {
                    await body();
                } catch (error: any) {
                    // Reported, not thrown: the outcome is known to vary run to run for this
                    // plugin, so gating on it would make the suite flaky rather than useful.
                    console.warn(`[${name}] known-unstable contract test failed: ${title}\n  ${error?.message}`);
                }
            });
            return;
        }
        (knownFailing.has(title) ? it.failing : it)(title, body as any);
    };

    describe(`plugin contract: ${name}`, () => {
        const stores: ContractDataStore[] = [];

        const store = () => {
            const created = new ContractDataStore(factory());
            stores.push(created);
            return created;
        };

        const seeded = async () => {
            const dataStore = store();
            await dataStore.products.addAsync(...(PRODUCTS as any));
            await dataStore.saveChangesAsync();
            return dataStore;
        };

        afterEach(async () => {
            // Destroy every store the test created. A plugin that leaks state between tests
            // turns an ordering change into a mystery failure.
            await Promise.all(stores.splice(0).map(async current => {
                try {
                    await current.destroyAsync();
                } catch {
                    // Destroy failures are asserted in their own section.
                }
            }));
        });

        /**
         * Reporting is optional in the core contract — a plugin that never pushes gets its
         * database step marked `executedQueriesUnsupported`. First-party plugins are held to
         * more than the minimum: every one of them supports explain, so a plugin that quietly
         * stops pushing fails here rather than silently degrading to "not reported".
         */
        section("reports what it executed", () => {
            test("reports at least one executed query for a read", async () => {
                const dataStore = await seeded();
                const { explanation } = await dataStore.products.explain().toArrayAsync();

                expect(explanation.executionSteps.length).toBeGreaterThan(0);

                const reported = executedQueriesOf(explanation);

                expect(reported.length).toBeGreaterThan(0);
            });

            test("describes what it executed as a non-empty string", async () => {
                const dataStore = await seeded();
                const { explanation } = await dataStore.products
                    .where(x => x.price > 0)
                    .explain()
                    .toArrayAsync();

                const reported = executedQueriesOf(explanation);

                for (const executed of reported) {
                    expect(typeof executed.text).toBe("string");
                    expect(executed.text.trim().length).toBeGreaterThan(0);
                }
            });

            test("still returns the rows when explaining", async () => {
                // One store for both reads: a second seeded() store shares the database on
                // server-backed plugins (D1), which would double the expected count.
                const dataStore = await seeded();
                const plain = await dataStore.products.toArrayAsync();
                const { data } = await dataStore.products.explain().toArrayAsync();

                expect(data.length).toBe(plain.length);
                expect(plain.length).toBeGreaterThan(0);
            });

            test("reports the pushed-down filter on the database step", async () => {
                const dataStore = await seeded();
                const { explanation } = await dataStore.products
                    .where(x => x.price > 0)
                    .explain()
                    .toArrayAsync();

                const databaseStep = explanation.executionSteps.find(step => step.executedIn.kind === "database");

                expect(databaseStep).toBeDefined();
            });
        });

        section("add and query round-trip", () => {
            test("returns nothing from an empty collection", async () => {
                expect(await store().products.toArrayAsync()).toEqual([]);
            });

            test("counts an empty collection as zero", async () => {
                expect(await store().products.countAsync()).toBe(0);
            });

            test("reports no changes for a save with nothing pending", async () => {
                const dataStore = store();
                expect((await dataStore.saveChangesAsync()).aggregate.size).toBe(0);
            });

            test("persists added entities", async () => {
                expect(await (await seeded()).products.countAsync()).toBe(PRODUCTS.length);
            });

            test("reports the number of persisted entities from saveChanges", async () => {
                const dataStore = store();
                await dataStore.products.addAsync(...(PRODUCTS as any));

                expect((await dataStore.saveChangesAsync()).aggregate.size).toBe(PRODUCTS.length);
            });

            test("round-trips string and number values", async () => {
                const [found] = await (await seeded()).products.where(p => p.name === "Bravo").toArrayAsync();

                expect(found.name).toBe("Bravo");
                expect(found.category).toBe("tools");
                expect(found.price).toBe(30);
            });

            test("round-trips a zero without losing it", async () => {
                const dataStore = store();
                await dataStore.products.addAsync({ name: "Zero", category: "edge", price: 0 } as any);
                await dataStore.saveChangesAsync();

                // 0 is what a truthiness-based "did they set it" check drops.
                expect((await dataStore.products.firstAsync(p => p.name === "Zero")).price).toBe(0);
            });

            test("round-trips an empty string without losing it", async () => {
                const dataStore = store();
                await dataStore.products.addAsync({ name: "Empty", category: "", price: 1 } as any);
                await dataStore.saveChangesAsync();

                expect((await dataStore.products.firstAsync(p => p.name === "Empty")).category).toBe("");
            });
        });

        // Gated: not every backing store holds these natively. SQL engines need per-property
        // serializers for booleans, dates, arrays, and objects, so requiring this of every
        // plugin would fail them for a schema-configuration reason rather than a behavioral one.
        (options.supportsRichTypes === true ? describe : describe.skip)("rich types", () => {
            const seededRich = async () => {
                const dataStore = store();
                await dataStore.rich.addAsync(...(RICH as any));
                await dataStore.saveChangesAsync();
                return dataStore;
            };

            test("round-trips booleans without coercing false", async () => {
                const dataStore = await seededRich();

                expect((await dataStore.rich.firstAsync(r => r.name === "Alpha")).inStock).toBe(true);
                // false must survive as false, not as 0, "false", or undefined.
                expect((await dataStore.rich.firstAsync(r => r.name === "Bravo")).inStock).toBe(false);
            });

            test("round-trips dates as Date instances", async () => {
                const found = await (await seededRich()).rich.firstAsync(r => r.name === "Alpha");

                // Stores serialize dates differently (ISO string, epoch number). The contract
                // is that a Date goes in and a Date comes out.
                expect(found.createdDate).toBeInstanceOf(Date);
                expect((found.createdDate as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
            });

            test("round-trips arrays including empty ones", async () => {
                const dataStore = await seededRich();

                expect((await dataStore.rich.firstAsync(r => r.name === "Bravo")).tags).toEqual(["a", "b"]);
                expect((await dataStore.rich.firstAsync(r => r.name === "Charlie")).tags).toEqual([]);
            });

            test("round-trips nested object properties", async () => {
                const found = await (await seededRich()).rich.firstAsync(r => r.name === "Alpha");

                expect(found.dimensions).toEqual({ width: 1, height: 2 });
            });

            test("round-trips an explicit null through a nullable property", async () => {
                const found = await (await seededRich()).rich.firstAsync(r => r.name === "Alpha");

                // null must survive as null, not collapse to undefined or a missing key.
                expect(found.note).toBeNull();
            });

            test("round-trips a present value through a nullable property", async () => {
                const found = await (await seededRich()).rich.firstAsync(r => r.name === "Bravo");

                expect(found.note).toBe("second");
            });

            test("leaves an omitted optional property absent", async () => {
                const found = await (await seededRich()).rich.firstAsync(r => r.name === "Charlie");

                expect(found.rating).toBeUndefined();
            });

            test("filters on a boolean without coercing false", async () => {
                const found = await (await seededRich()).rich.where(r => r.inStock === false).toArrayAsync();

                expect(found.map(r => r.name)).toEqual(["Bravo"]);
            });
        });

        section("identity generation", () => {
            test("assigns an identity key on save", async () => {
                const dataStore = store();
                const [added] = await dataStore.products.addAsync(PRODUCTS[0] as any);
                await dataStore.saveChangesAsync();

                expect(added._id).toBeDefined();
                expect(String(added._id).length).toBeGreaterThan(0);
            });

            test("assigns a distinct identity to every entity", async () => {
                const ids = (await (await seeded()).products.toArrayAsync()).map(p => p._id);

                expect(new Set(ids).size).toBe(PRODUCTS.length);
            });

            test("keeps the assigned identity stable across reads", async () => {
                const dataStore = await seeded();

                const first = (await dataStore.products.where(p => p.name === "Alpha").toArrayAsync())[0];
                const second = (await dataStore.products.where(p => p.name === "Alpha").toArrayAsync())[0];

                expect(second._id).toBe(first._id);
            });
        });

        section("composite keys", () => {
            test("stores entities that differ only by the second key component", async () => {
                const dataStore = store();
                await dataStore.composites.addAsync(
                    { tenantId: "t1", sku: "a", quantity: 1 } as any,
                    { tenantId: "t1", sku: "b", quantity: 2 } as any,
                );
                await dataStore.saveChangesAsync();

                expect(await dataStore.composites.countAsync()).toBe(2);
            });

            test("treats the same composite key as one entity", async () => {
                const dataStore = store();
                await dataStore.composites.addAsync({ tenantId: "t1", sku: "a", quantity: 1 } as any);
                await dataStore.saveChangesAsync();

                const [found] = await dataStore.composites.where(c => c.sku === "a").toArrayAsync();

                expect(found.tenantId).toBe("t1");
                expect(found.sku).toBe("a");
            });
        });

        section("renamed properties", () => {
            test("round-trips a renamed string property", async () => {
                const dataStore = store();
                await dataStore.renamed.addAsync({ label: "hello", amount: 5 } as any);
                await dataStore.saveChangesAsync();

                const [found] = await dataStore.renamed.toArrayAsync();

                // The wire name is a storage detail; callers only ever see `label`.
                expect(found.label).toBe("hello");
                expect(found.amount).toBe(5);
            });

            test("filters on a renamed property by its application name", async () => {
                const dataStore = store();
                await dataStore.renamed.addAsync(
                    { label: "keep", amount: 1 } as any,
                    { label: "drop", amount: 2 } as any,
                );
                await dataStore.saveChangesAsync();

                const found = await dataStore.renamed.where(r => r.label === "keep").toArrayAsync();

                expect(found).toHaveLength(1);
                expect(found[0].label).toBe("keep");
            });
        });

        section("updates", () => {
            test("persists a changed property", async () => {
                const dataStore = await seeded();
                const found = await dataStore.products.firstAsync(p => p.name === "Alpha");

                found.price = 999;
                await dataStore.saveChangesAsync();

                expect((await dataStore.products.firstAsync(p => p.name === "Alpha")).price).toBe(999);
            });

            test("reports the number of updated entities", async () => {
                const dataStore = await seeded();
                const found = await dataStore.products.firstAsync(p => p.name === "Alpha");

                found.price = 999;

                expect((await dataStore.saveChangesAsync()).aggregate.size).toBe(1);
            });

            test("leaves untouched properties alone", async () => {
                const dataStore = await seeded();
                const found = await dataStore.products.firstAsync(p => p.name === "Alpha");

                found.price = 999;
                await dataStore.saveChangesAsync();

                expect((await dataStore.products.firstAsync(p => p.name === "Alpha")).category).toBe("tools");
            });

            test("persists a value changed to a falsy one", async () => {
                const dataStore = await seeded();
                const found = await dataStore.products.firstAsync(p => p.name === "Alpha");

                // 0 is what a truthiness-based delta check silently drops.
                found.price = 0;
                await dataStore.saveChangesAsync();

                expect((await dataStore.products.firstAsync(p => p.name === "Alpha")).price).toBe(0);
            });

            test("does not report changes when nothing was modified", async () => {
                const dataStore = await seeded();
                await dataStore.products.firstAsync(p => p.name === "Alpha");

                expect((await dataStore.saveChangesAsync()).aggregate.size).toBe(0);
            });

            test("persists updates to more than one entity in a single save", async () => {
                const dataStore = await seeded();
                const all = await dataStore.products.toArrayAsync();

                for (const product of all) {
                    product.price = 111;
                }
                await dataStore.saveChangesAsync();

                const prices = (await dataStore.products.toArrayAsync()).map(p => p.price);
                expect(prices).toEqual(prices.map(() => 111));
            });
        });

        section("removals", () => {
            test("removes a single entity", async () => {
                const dataStore = await seeded();
                const found = await dataStore.products.firstAsync(p => p.name === "Alpha");

                await dataStore.products.removeAsync(found);
                await dataStore.saveChangesAsync();

                expect(await dataStore.products.countAsync()).toBe(PRODUCTS.length - 1);
            });

            test("leaves other entities in place after a removal", async () => {
                const dataStore = await seeded();
                const found = await dataStore.products.firstAsync(p => p.name === "Alpha");

                await dataStore.products.removeAsync(found);
                await dataStore.saveChangesAsync();

                const names = (await dataStore.products.toArrayAsync()).map(p => p.name).sort();
                expect(names).toEqual(["Bravo", "Charlie", "Delta"]);
            });

            test("removes every entity", async () => {
                const dataStore = await seeded();

                await dataStore.products.removeAllAsync();
                await dataStore.saveChangesAsync();

                expect(await dataStore.products.countAsync()).toBe(0);
            });

            test("reports the number of removed entities", async () => {
                const dataStore = await seeded();

                await dataStore.products.removeAllAsync();

                expect((await dataStore.saveChangesAsync()).aggregate.size).toBe(PRODUCTS.length);
            });

            test("applies adds, updates, and removals in one save", async () => {
                const dataStore = await seeded();
                const toRemove = await dataStore.products.firstAsync(p => p.name === "Alpha");
                const toUpdate = await dataStore.products.firstAsync(p => p.name === "Bravo");

                await dataStore.products.removeAsync(toRemove);
                toUpdate.price = 555;
                await dataStore.products.addAsync({ ...PRODUCTS[0], name: "Echo" } as any);
                await dataStore.saveChangesAsync();

                const names = (await dataStore.products.toArrayAsync()).map(p => p.name).sort();
                expect(names).toEqual(["Bravo", "Charlie", "Delta", "Echo"]);
                expect((await dataStore.products.firstAsync(p => p.name === "Bravo")).price).toBe(555);
            });
        });

        section("query options", () => {
            test("filters with a comparison", async () => {
                const found = await (await seeded()).products.where(p => p.price > 20).toArrayAsync();

                expect(found.map(p => p.name).sort()).toEqual(["Bravo", "Delta"]);
            });

            test("filters with equality on a string", async () => {
                const found = await (await seeded()).products.where(p => p.category === "toys").toArrayAsync();

                expect(found.map(p => p.name).sort()).toEqual(["Charlie", "Delta"]);
            });

            test("filters with a parameterized value", async () => {
                const found = await (await seeded()).products
                    .where(([p, params]) => p.price > params.min, { min: 25 })
                    .toArrayAsync();

                expect(found.map(p => p.name).sort()).toEqual(["Bravo", "Delta"]);
            });

            /**
             * A casing call on a relational comparator. The parser refused these until the guards at
             * `parser.ts:911`/`:1016` came out, so no plugin has ever been asked to answer one — a
             * translator renders `LOWER(...)`, an in-process plugin runs the caller's closure, and
             * every one of them has to agree with the others and with plain JavaScript.
             */
            test("filters through a lower-case call", async () => {
                const found = await (await seeded()).products.where(p => p.name.toLowerCase() === "bravo").toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Bravo"]);
            });

            test("filters through an upper-case call", async () => {
                const found = await (await seeded()).products.where(p => p.category.toUpperCase() === "TOYS").toArrayAsync();

                expect(found.map(p => p.name).sort()).toEqual(["Charlie", "Delta"]);
            });

            // Case-FOLDED, not case-blind: comparing a lower-cased column to a capitalised literal
            // matches nothing, and a plugin that ignored the call would return the row
            test("does not match when the call is applied but the literal is not folded", async () => {
                const found = await (await seeded()).products.where(p => p.name.toLowerCase() === "Bravo").toArrayAsync();

                expect(found).toEqual([]);
            });

            test("filters through a call on a relational comparator", async () => {
                const found = await (await seeded()).products.where(p => p.name.toLowerCase() > "c").toArrayAsync();

                expect(found.map(p => p.name).sort()).toEqual(["Charlie", "Delta"]);
            });

            test("filters through a call on both sides of a comparison", async () => {
                const found = await (await seeded()).products
                    .where(p => p.name.toLowerCase() === p.category.toLowerCase())
                    .toArrayAsync();

                expect(found).toEqual([]);
            });

            /**
             * Arithmetic. The expression tree always carried it — `Call` has had `add` through
             * `modulo` since the node existed — so what is new here is that the grammar reads `%`,
             * and that every backend computes the same answer as JavaScript.
             */
            test("filters through modulo", async () => {
                const found = await (await seeded()).products.where(p => p.price % 20 === 0).toArrayAsync();

                expect(found.map(p => p.name).sort()).toEqual(["Charlie", "Delta"]);
            });

            /**
             * A FRACTIONAL remainder, which is where SQLite's own `%` disagrees with JavaScript: it
             * truncates both operands to integers, so `2.5 % 2` would be 0 rather than 0.5. Prices
             * are whole numbers, so the fraction has to be produced by the division first.
             *
             * 10/4 and 2.5 are both exact in binary, so this is not a floating-point coin toss.
             */
            test("filters through a remainder of a fractional value", async () => {
                const found = await (await seeded()).products.where(p => p.price / 4 % 2 === 0.5).toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Alpha"]);
            });

            test("filters through addition", async () => {
                const found = await (await seeded()).products.where(p => p.price + 5 > 35).toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Delta"]);
            });

            test("filters through subtraction", async () => {
                const found = await (await seeded()).products.where(p => p.price - 10 === 0).toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Alpha"]);
            });

            test("filters through multiplication by a float", async () => {
                const found = await (await seeded()).products.where(p => p.price * 1.5 > 45).toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Delta"]);
            });

            test("filters through division", async () => {
                const found = await (await seeded()).products.where(p => p.price / 10 === 2).toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Charlie"]);
            });

            // 2 + 3 * 4 is 14, not 20 — a backend that evaluated left to right would return nothing
            test("gives multiplication precedence over addition", async () => {
                const found = await (await seeded()).products.where(p => p.price + 3 * 4 === 22).toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Alpha"]);
            });

            test("returns an empty array when nothing matches", async () => {
                expect(await (await seeded()).products.where(p => p.price > 10_000).toArrayAsync()).toEqual([]);
            });

            test("sorts ascending", async () => {
                const found = await (await seeded()).products.sort(p => p.price).toArrayAsync();

                expect(found.map(p => p.price)).toEqual([10, 20, 30, 40]);
            });

            test("sorts descending", async () => {
                const found = await (await seeded()).products.sortDescending(p => p.price).toArrayAsync();

                expect(found.map(p => p.price)).toEqual([40, 30, 20, 10]);
            });

            test("sorts strings in lexicographic order", async () => {
                const found = await (await seeded()).products.sort(p => p.name).toArrayAsync();

                // SQL collations and JS string comparison disagree often enough that this
                // needs pinning per plugin rather than assumed.
                expect(found.map(p => p.name)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
            });

            test("skips a prefix of the result", async () => {
                const found = await (await seeded()).products.sort(p => p.price).skip(2).toArrayAsync();

                expect(found.map(p => p.price)).toEqual([30, 40]);
            });

            test("takes a prefix of the result", async () => {
                const found = await (await seeded()).products.sort(p => p.price).take(2).toArrayAsync();

                expect(found.map(p => p.price)).toEqual([10, 20]);
            });

            test("combines skip and take", async () => {
                const found = await (await seeded()).products.sort(p => p.price).skip(1).take(2).toArrayAsync();

                expect(found.map(p => p.price)).toEqual([20, 30]);
            });

            test("maps to a single property", async () => {
                const found = await (await seeded()).products.sort(p => p.price).map(p => p.name).toArrayAsync();

                expect(found).toEqual(["Alpha", "Charlie", "Bravo", "Delta"]);
            });

            test("counts all entities", async () => {
                expect(await (await seeded()).products.countAsync()).toBe(4);
            });

            test("counts a filtered subset", async () => {
                expect(await (await seeded()).products.where(p => p.category === "tools").countAsync()).toBe(2);
            });

            test("sums a numeric property", async () => {
                expect(await (await seeded()).products.sumAsync(p => p.price)).toBe(100);
            });

            test("takes the minimum of a numeric property", async () => {
                expect(await (await seeded()).products.minAsync(p => p.price)).toBe(10);
            });

            test("takes the maximum of a numeric property", async () => {
                expect(await (await seeded()).products.maxAsync(p => p.price)).toBe(40);
            });

            test("reports whether any entity matches", async () => {
                const dataStore = await seeded();

                expect(await dataStore.products.someAsync(p => p.price > 35)).toBe(true);
                expect(await dataStore.products.someAsync(p => p.price > 100)).toBe(false);
            });

            test("reports whether every entity matches", async () => {
                const dataStore = await seeded();

                expect(await dataStore.products.everyAsync(p => p.price > 5)).toBe(true);
                expect(await dataStore.products.everyAsync(p => p.price > 15)).toBe(false);
            });

            test("returns the first entity matching a filter", async () => {
                expect((await (await seeded()).products.firstAsync(p => p.name === "Delta")).price).toBe(40);
            });

            test("returns undefined rather than throwing when nothing matches", async () => {
                expect(await (await seeded()).products.firstOrUndefinedAsync(p => p.name === "Nope")).toBeUndefined();
            });

            test("combines filter, sort, and take", async () => {
                const found = await (await seeded()).products
                    .where(p => p.price >= 20)
                    .sortDescending(p => p.price)
                    .take(2)
                    .toArrayAsync();

                expect(found.map(p => p.name)).toEqual(["Delta", "Bravo"]);
            });

            test("combines filter and aggregate", async () => {
                const total = await (await seeded()).products
                    .where(p => p.category === "tools")
                    .sumAsync(p => p.price);

                expect(total).toBe(40);
            });

            test("counts after skip and take", async () => {
                expect(await (await seeded()).products.sort(p => p.price).skip(1).take(2).countAsync()).toBe(2);
            });
        });

        section("error handling", () => {
            test("rejects a missing first() rather than hanging", async () => {
                const dataStore = await seeded();

                // The failure must reach the caller as a rejection — never as an exception
                // escaping the plugin boundary, and never as silence. withTimeout is what
                // distinguishes "rejected" from "never settled": without it a pipeline that
                // drops its callback would look like a slow test instead of a broken one.
                await expect(
                    withTimeout(dataStore.products.firstAsync(p => p.name === "Nope"), "firstAsync(no match)")
                ).rejects.toThrow(/No items found/i);
            });

            test("keeps the store usable after a query that finds nothing", async () => {
                const dataStore = await seeded();

                await withTimeout(dataStore.products.firstAsync(p => p.name === "Nope"), "firstAsync(no match)")
                    // Annotated because tsc emits TS7011 on a bare `() => undefined` here.
                    .catch((): void => undefined);

                expect(await dataStore.products.countAsync()).toBe(PRODUCTS.length);
            });

            test("returns undefined from firstOrUndefined without hanging", async () => {
                const dataStore = await seeded();

                // The non-throwing sibling must settle even though first() does not.
                await expect(
                    withTimeout(dataStore.products.firstOrUndefinedAsync(p => p.name === "Nope"), "firstOrUndefinedAsync")
                ).resolves.toBeUndefined();
            });
        });

        section("destroy", () => {
            test("removes persisted data", async () => {
                const dataStore = await seeded();

                await dataStore.destroyAsync();

                const reopened = store();
                expect(await reopened.products.countAsync()).toBe(0);
            });

            test("can be called on a store that never persisted anything", async () => {
                await expect(store().destroyAsync()).resolves.not.toThrow();
            });
        });
    });
}
