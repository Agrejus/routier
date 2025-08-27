import { describe, it, expect } from 'vitest';
import { DataStore } from '.';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from 'routier-core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from 'routier-core/results';
import { now } from 'routier-core/performance';
import { BulkPersistResult } from 'routier-core/collections';
import { InferCreateType, s } from 'routier-core/schema';
import { uuid, uuidv4 } from 'routier-core';

describe('Data Store', () => {

    describe('Performance', () => {
        const simple = s.define("simple", {
            id: s.number().key(),
            name: s.string(),
        }).compile();
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