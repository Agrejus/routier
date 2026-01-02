import { describe, it, expect } from '@jest/globals';
import { DataStore } from '.';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, TranslatedArrayValue } from '@routier/core/plugins';
import { now } from '@routier/core/performance';
import { BulkPersistResult } from '@routier/core/collections';
import { InferCreateType, s } from '@routier/core/schema';
import { logger, uuid, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';

const simple = s.define("simple", {
    id: s.number().key(),
    name: s.string(),
}).compile();

type GenericPluginOptions = {
    onQuery?: <TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>) => void,
    onDestroy?: (event: DbPluginEvent) => void,
    onBulkPersist?: (event: DbPluginBulkPersistEvent) => void
}
class GenericPlugin extends MemoryPlugin {

    private options?: GenericPluginOptions;

    constructor(options?: GenericPluginOptions) {
        super(uuidv4());
        this.options = options;
    }

    async query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>): Promise<ITranslatedValue<TShape>> {
        this.options?.onQuery?.(event);
        return await super.query(event);
    }

    async destroy(event: DbPluginEvent): Promise<void> {
        this.options?.onDestroy?.(event);
        await super.destroy(event);
    }

    async bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        this.options?.onBulkPersist?.(event);
        return await super.bulkPersist(event);
    }
}

class GenericDataStore extends DataStore {

    simple = this.collection(simple).create();
}

const genericFactory = (options?: GenericPluginOptions) => {
    return new GenericDataStore(new GenericPlugin(options));
}

describe('Data Store', () => {

    describe("Tags", () => {

        it('should tag added entity', async () => {

            logger.log("test");

            let resolve!: () => void;
            const called = new Promise<void>(r => { resolve = r; });

            const onBulkPersist = (event: DbPluginBulkPersistEvent) => {

                for (const [, changes] of event.operation) {
                    expect(changes.tags.size).toBe(1);

                    for (const [entity, tag] of changes.tags) {
                        expect((entity as any).id).toBe(1);
                        expect(tag).toBe("test");
                    }
                }
                resolve();
            };

            const store = genericFactory({ onBulkPersist });
            await store.simple.tag('test').addAsync({ id: 1, name: 'name' });
            await store.saveChangesAsync();

            await called; // waits until callback ran
        });

        it('should tag added entities', async () => {

            let resolve!: () => void;
            const called = new Promise<void>(r => { resolve = r; });

            const onBulkPersist = (event: DbPluginBulkPersistEvent) => {

                for (const [, changes] of event.operation) {
                    expect(changes.tags.size).toBe(3);

                    let count = 0;
                    for (const [entity, tag] of changes.tags) {
                        count++;
                        expect((entity as any).id).toBe(count);
                        expect(tag).toBe("test");
                    }
                }
                resolve();
            };

            const store = genericFactory({ onBulkPersist });
            await store.simple.tag('test').addAsync(
                { id: 1, name: 'name 1' },
                { id: 2, name: 'name 2' },
                { id: 3, name: 'name 3' }
            );
            await store.saveChangesAsync();

            await called; // waits until callback ran
        });

        it('should tag update', async () => {

            let resolve!: () => void;
            const called = new Promise<void>(r => { resolve = r; });
            let count = 0;

            const onBulkPersist = (event: DbPluginBulkPersistEvent) => {

                for (const [, changes] of event.operation) {
                    count++;

                    if (count === 2) {
                        expect(changes.tags.size).toBe(1);
                    }
                }
                resolve();
            };

            const store = genericFactory({ onBulkPersist });
            await store.simple.addAsync({ id: 1, name: 'name' });
            await store.saveChangesAsync();

            const found = await store.simple.tag("test").firstAsync();

            found.name = "updated";

            await store.saveChangesAsync();

            await called; // waits until callback ran
        });
    });

    describe('Performance', () => {
        const cache: Record<string, { start: number, end: number }> = {};

        class PerformancePlugin implements IDbPlugin {

            private id: string;

            constructor(id: string) {
                this.id = id;
            }

            async query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>): Promise<ITranslatedValue<TShape>> {
                cache[this.id].end = now();
                return new TranslatedArrayValue<TShape>([]);
            }

            async destroy(event: DbPluginEvent): Promise<void> {
                cache[this.id].end = now();
            }

            async bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
                cache[this.id].end = now();
                return new BulkPersistResult();
            }
        }

        class TestDataStore extends DataStore {

            constructor(id: string, plugin: IDbPlugin) {
                super(plugin);
                this.simple.id = id;
            }

            simple = this.collection(simple).create((Instance, ...args) => {
                return new class extends Instance {

                    id: string;

                    constructor() {
                        super(...args);
                    }

                    async addPerformanceAsync(...entities: InferCreateType<typeof simple>[]) {
                        const reuslt = await super.addAsync(...entities);
                        cache[this.id].end = now();
                        return reuslt;
                    }

                }
            });
        }

        const factory = (id: string) => {
            cache[id] = { start: now(), end: 0 };
            return new TestDataStore(id, new PerformancePlugin(id));
        }

        it('Can add 1 item under 1ms', async () => {

            const id = uuidv4();
            const store = factory(id);

            await store.simple.addPerformanceAsync({
                id: 1,
                name: "sample"
            });

            const { start, end } = cache[id];
            const delta = end - start;

            expect(delta).toBeLessThan(1);
        });

        it('Can add 1000 items under 1.5ms', async () => {

            const id = uuidv4();
            const items: InferCreateType<typeof simple>[] = [];

            for (let i = 0; i < 1000; i++) {
                items.push({
                    id: i + 1,
                    name: uuid(32)
                });
            }

            const store = factory(id);
            await store.simple.addPerformanceAsync(...items);

            const { start, end } = cache[id];
            const delta = end - start;

            expect(delta).toBeLessThan(1.5);
        });

        it("should query under 1.5ms", async () => {
            const id = uuidv4();
            const store = factory(id);

            await store.simple.where(x => x.name === "James" && x.id != 0).toArrayAsync();

            const { start, end } = cache[id];
            const delta = end - start;

            expect(delta).toBeLessThan(1.5);
        })
    });

    describe('Callbacks vs Promises Performance', () => {

        it('should measure async/await performance for bulk operations', async () => {
            const store = genericFactory();
            const iterations = 10000;
            const items: InferCreateType<typeof simple>[] = [];

            for (let i = 0; i < iterations; i++) {
                items.push({
                    id: i + 1,
                    name: `item-${i}`
                });
            }

            const start = now();

            await store.simple.addAsync(...items);
            await store.saveChangesAsync();

            const end = now();
            const totalTime = end - start;
            const avgTimePerOp = totalTime / iterations;

            logger.log(`Async/Await: ${totalTime.toFixed(3)}ms total, ${avgTimePerOp.toFixed(6)}ms per operation for ${iterations} items`);

            expect(totalTime).toBeLessThan(100);
        });

        it('should measure async/await performance for sequential operations', async () => {
            const store = genericFactory();
            const iterations = 1000;

            const start = now();

            for (let i = 0; i < iterations; i++) {
                await store.simple.addAsync({ id: i + 1, name: `item-${i}` });
                await store.saveChangesAsync();
            }

            const end = now();
            const totalTime = end - start;
            const avgTimePerOp = totalTime / iterations;

            logger.log(`Async/Await Sequential: ${totalTime.toFixed(3)}ms total, ${avgTimePerOp.toFixed(6)}ms per operation for ${iterations} sequential add+save cycles`);

            expect(totalTime).toBeLessThan(500);
        });

        it('should measure async/await performance for query operations', async () => {
            const store = genericFactory();
            const items: InferCreateType<typeof simple>[] = [];

            for (let i = 0; i < 1000; i++) {
                items.push({
                    id: i + 1,
                    name: i % 2 === 0 ? 'even' : 'odd'
                });
            }

            await store.simple.addAsync(...items);
            await store.saveChangesAsync();

            const iterations = 100;
            const start = now();

            for (let i = 0; i < iterations; i++) {
                await store.simple.where(x => x.name === 'even').toArrayAsync();
            }

            const end = now();
            const totalTime = end - start;
            const avgTimePerOp = totalTime / iterations;

            logger.log(`Async/Await Query: ${totalTime.toFixed(3)}ms total, ${avgTimePerOp.toFixed(6)}ms per query for ${iterations} queries`);

            expect(totalTime).toBeLessThan(200);
        });

        it('should measure async/await overhead for nested operations', async () => {
            const store = genericFactory();
            const iterations = 50;

            const start = now();

            for (let i = 0; i < iterations; i++) {
                await store.simple.addAsync({ id: i + 1, name: `item-${i}` });
                await store.saveChangesAsync();

                const result = await store.simple.where(x => x.id === i + 1).firstAsync();
                expect(result).toBeDefined();
            }

            const end = now();
            const totalTime = end - start;
            const avgTimePerOp = totalTime / iterations;

            logger.log(`Async/Await Nested: ${totalTime.toFixed(3)}ms total, ${avgTimePerOp.toFixed(6)}ms per nested operation for ${iterations} add+query+save cycles`);

            expect(totalTime).toBeLessThan(300);
        });

        it('should document callback vs promise performance characteristics', async () => {
            const store = genericFactory();
            const iterations = 100;

            const asyncStart = now();
            for (let i = 0; i < iterations; i++) {
                await store.simple.addAsync({ id: i + 1, name: `item-${i}` });
            }
            await store.saveChangesAsync();
            const asyncEnd = now();
            const asyncTime = asyncEnd - asyncStart;

            logger.log(`
Performance Comparison (${iterations} operations):
===============================================
Async/Await Implementation:
  - Total time: ${asyncTime.toFixed(3)}ms
  - Avg per op: ${(asyncTime / iterations).toFixed(6)}ms
  
Callback Implementation (theoretical):
  - Would use synchronous callback execution via TrampolinePipeline
  - No Promise overhead (no microtask queue)
  - Direct function calls
  - Potentially faster for high-frequency operations
  - But: Less readable, harder to debug, no native error handling

Current Implementation Benefits:
  - Native error handling with try/catch
  - Better stack traces
  - Easier to debug
  - Standard JavaScript patterns
  - Better TypeScript inference
            `);

            expect(asyncTime).toBeLessThan(50);
        });
    });
}); 