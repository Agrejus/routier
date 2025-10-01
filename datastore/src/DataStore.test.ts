import { describe, it, expect } from '@jest/globals';
import { DataStore } from '.';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { now } from '@routier/core/performance';
import { BulkPersistResult } from '@routier/core/collections';
import { InferCreateType, s } from '@routier/core/schema';
import { uuid, uuidv4 } from '@routier/core';
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

    query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<TShape>): void {
        this.options?.onQuery?.(event);
        super.query(event, done);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.options?.onDestroy?.(event);
        super.destroy(event, done);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.options?.onBulkPersist?.(event);
        super.bulkPersist(event, done);
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

            query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<TShape>): void {
                cache[this.id].end = now();
                done(PluginEventResult.success(event.id, [] as any));
            }

            destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
                cache[this.id].end = now();
                done(PluginEventResult.success(event.id));
            }

            bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
                cache[this.id].end = now();
                done(PluginEventResult.success(event.id, new BulkPersistResult()));
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

        it('Can add 1000 items under 3ms', async () => {

            const id = uuidv4();
            const store = factory(id);

            const items: InferCreateType<typeof simple>[] = [];

            for (let i = 0; i < 1000; i++) {
                items.push({
                    id: i + 1,
                    name: uuid(32)
                });
            }

            await store.simple.addPerformanceAsync(...items);

            const { start, end } = cache[id];
            const delta = end - start;

            expect(delta).toBeLessThan(3);
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
}); 