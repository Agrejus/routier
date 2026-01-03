import { describe, it, expect } from '@jest/globals';
import { DataStore } from '.';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, TranslatedArrayValue } from '@routier/core/plugins';
import { now } from '@routier/core/performance';
import { BulkPersistResult } from '@routier/core/collections';
import { InferCreateType, s } from '@routier/core/schema';
import { logger, BenchmarkCapability, PluginEventCallbackPartialResult, PluginEventCallbackResult, uuid, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import fs from 'node:fs';
import path from 'node:path';

interface BenchmarkTask {
    name: string;
    fn: () => Promise<unknown> | unknown;
}

interface BenchmarkResult {
    name: string;
    totalTime: number;
    iterations: number;
    avgTimePerOp: number;
    opsPerSecond: number;
    minTime: number;
    maxTime: number;
    warmupTime?: number;
}

interface BenchmarkOptions {
    iterations?: number;
    warmupIterations?: number;
}

class Benchmark {
    private tasks: BenchmarkTask[] = [];
    private results: BenchmarkResult[] = [];

    add(name: string, fn: () => Promise<unknown> | unknown): this {
        this.tasks.push({ name, fn });
        return this;
    }

    async run(options: BenchmarkOptions = {}): Promise<BenchmarkResult[]> {
        const {
            iterations = 1000,
            warmupIterations = 100
        } = options;

        this.results = [];

        for (const task of this.tasks) {
            if (warmupIterations > 0) {
                const warmupStart = now();
                for (let i = 0; i < warmupIterations; i++) {
                    await task.fn();
                }
                const warmupTime = now() - warmupStart;

                const times: number[] = [];
                const start = now();

                for (let i = 0; i < iterations; i++) {
                    const iterStart = now();
                    await task.fn();
                    const iterTime = now() - iterStart;
                    times.push(iterTime);
                }

                const end = now();
                const totalTime = end - start;
                const avgTimePerOp = totalTime / iterations;
                const opsPerSecond = 1000 / avgTimePerOp;
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);

                this.results.push({
                    name: task.name,
                    totalTime,
                    iterations,
                    avgTimePerOp,
                    opsPerSecond,
                    minTime,
                    maxTime,
                    warmupTime
                });
            } else {
                const times: number[] = [];
                const start = now();

                for (let i = 0; i < iterations; i++) {
                    const iterStart = now();
                    await task.fn();
                    const iterTime = now() - iterStart;
                    times.push(iterTime);
                }

                const end = now();
                const totalTime = end - start;
                const avgTimePerOp = totalTime / iterations;
                const opsPerSecond = 1000 / avgTimePerOp;
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);

                this.results.push({
                    name: task.name,
                    totalTime,
                    iterations,
                    avgTimePerOp,
                    opsPerSecond,
                    minTime,
                    maxTime
                });
            }
        }

        return this.results;
    }

    getResults(): BenchmarkResult[] {
        return this.results;
    }

    fastest(): BenchmarkResult | null {
        if (this.results.length === 0) return null;
        return this.results.reduce((fastest, result) =>
            result.avgTimePerOp < fastest.avgTimePerOp ? result : fastest
        );
    }

    slowest(): BenchmarkResult | null {
        if (this.results.length === 0) return null;
        return this.results.reduce((slowest, result) =>
            result.avgTimePerOp > slowest.avgTimePerOp ? result : slowest
        );
    }

    print(): void {
        if (this.results.length === 0) {
            logger.log('No benchmark results to display');
            return;
        }

        logger.log('\n📊 Benchmark Results');
        logger.log('='.repeat(80));

        this.results.forEach((result, index) => {
            logger.log(`\n${index + 1}. ${result.name}:`);
            logger.log(`   Total time:     ${result.totalTime.toFixed(3)}ms`);
            logger.log(`   Iterations:     ${result.iterations.toLocaleString()}`);
            logger.log(`   Avg time/op:    ${result.avgTimePerOp.toFixed(6)}ms`);
            logger.log(`   Min time:       ${result.minTime.toFixed(6)}ms`);
            logger.log(`   Max time:       ${result.maxTime.toFixed(6)}ms`);
            logger.log(`   Ops/sec:        ${result.opsPerSecond.toFixed(0)}`);
            if (result.warmupTime) {
                logger.log(`   Warmup time:    ${result.warmupTime.toFixed(3)}ms`);
            }
        });

        if (this.results.length > 1) {
            const fastest = this.fastest()!;
            const slowest = this.slowest()!;
            const ratio = slowest.avgTimePerOp / fastest.avgTimePerOp;

            logger.log('\n📈 Comparison:');
            logger.log(`   Fastest:        ${fastest.name} (${fastest.avgTimePerOp.toFixed(6)}ms/op)`);
            logger.log(`   Slowest:        ${slowest.name} (${slowest.avgTimePerOp.toFixed(6)}ms/op)`);
            logger.log(`   Performance:    ${ratio.toFixed(2)}x difference`);
        }

        logger.log('\n' + '='.repeat(80) + '\n');
    }

    table(): void {
        if (this.results.length === 0) {
            logger.log('No benchmark results to display');
            return;
        }

        const headers = ['Name', 'Total (ms)', 'Iterations', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'Ops/sec'];
        const rows = this.results.map(r => [
            r.name,
            r.totalTime.toFixed(3),
            r.iterations.toLocaleString(),
            r.avgTimePerOp.toFixed(6),
            r.minTime.toFixed(6),
            r.maxTime.toFixed(6),
            r.opsPerSecond.toFixed(0)
        ]);

        const colWidths = headers.map((_, i) => {
            const headerLen = headers[i].length;
            const maxDataLen = Math.max(...rows.map(r => r[i].length));
            return Math.max(headerLen, maxDataLen) + 2;
        });

        const pad = (str: string, width: number) => str.padEnd(width);

        logger.log('\n📊 Benchmark Results Table');
        logger.log('='.repeat(colWidths.reduce((a, b) => a + b, 0)));

        logger.log(headers.map((h, i) => pad(h, colWidths[i])).join(''));
        logger.log('-'.repeat(colWidths.reduce((a, b) => a + b, 0)));

        rows.forEach(row => {
            logger.log(row.map((cell, i) => pad(cell, colWidths[i])).join(''));
        });

        logger.log('='.repeat(colWidths.reduce((a, b) => a + b, 0)) + '\n');
    }

    reset(): this {
        this.tasks = [];
        this.results = [];
        return this;
    }

    async writeToFile(filePath?: string): Promise<string> {
        if (this.results.length === 0) {
            throw new Error('No benchmark results to write. Run benchmark first.');
        }

        const defaultPath = path.join(process.cwd(), 'benchmark-results.json');
        const outputPath = filePath || defaultPath;

        const output = {
            timestamp: new Date().toISOString(),
            results: this.results.map(r => ({
                name: r.name,
                totalTime: r.totalTime,
                iterations: r.iterations,
                avgTimePerOp: r.avgTimePerOp,
                opsPerSecond: r.opsPerSecond,
                minTime: r.minTime,
                maxTime: r.maxTime,
                warmupTime: r.warmupTime
            })),
            summary: this.results.length > 1 ? {
                fastest: this.fastest()?.name,
                slowest: this.slowest()?.name,
                performanceRatio: this.fastest() && this.slowest()
                    ? (this.slowest()!.avgTimePerOp / this.fastest()!.avgTimePerOp).toFixed(2)
                    : null
            } : null
        };

        const jsonOutput = JSON.stringify(output, null, 2);

        await fs.promises.writeFile(outputPath, jsonOutput, 'utf8');

        logger.log(`\n💾 Benchmark results written to: ${outputPath}\n`);

        return outputPath;
    }

    async writeToTextFile(filePath?: string): Promise<string> {
        if (this.results.length === 0) {
            throw new Error('No benchmark results to write. Run benchmark first.');
        }

        const defaultPath = path.join(process.cwd(), 'benchmark-results.txt');
        const outputPath = filePath || defaultPath;

        let output = `\n${'='.repeat(80)}\n`;
        output += `Benchmark Results\n`;
        output += `Generated: ${new Date().toISOString()}\n`;
        output += '='.repeat(80) + '\n\n';

        this.results.forEach((result, index) => {
            output += `${index + 1}. ${result.name}:\n`;
            output += `   Total time:     ${result.totalTime.toFixed(3)}ms\n`;
            output += `   Iterations:     ${result.iterations.toLocaleString()}\n`;
            output += `   Avg time/op:    ${result.avgTimePerOp.toFixed(6)}ms\n`;
            output += `   Min time:       ${result.minTime.toFixed(6)}ms\n`;
            output += `   Max time:       ${result.maxTime.toFixed(6)}ms\n`;
            output += `   Ops/sec:        ${result.opsPerSecond.toFixed(0)}\n`;
            if (result.warmupTime) {
                output += `   Warmup time:    ${result.warmupTime.toFixed(3)}ms\n`;
            }
            output += '\n';
        });

        if (this.results.length > 1) {
            const fastest = this.fastest()!;
            const slowest = this.slowest()!;
            const ratio = slowest.avgTimePerOp / fastest.avgTimePerOp;

            output += 'Comparison:\n';
            output += `   Fastest:        ${fastest.name} (${fastest.avgTimePerOp.toFixed(6)}ms/op)\n`;
            output += `   Slowest:        ${slowest.name} (${slowest.avgTimePerOp.toFixed(6)}ms/op)\n`;
            output += `   Performance:    ${ratio.toFixed(2)}x difference\n`;
        }

        output += '='.repeat(80) + '\n';

        await fs.promises.appendFile(outputPath, output, 'utf8');

        logger.log(`\n💾 Benchmark results appended to: ${outputPath}\n`);

        return outputPath;
    }
}

const createBenchmark = () => new Benchmark();

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

    query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
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
            return new TestDataStore(id, new MemoryPlugin(id));
        }

        it('Can add 1 item under 1ms', async () => {
            const bench = createBenchmark()
                .add('Add 1 Item', async () => {
                    const id = uuidv4();
                    const store = factory(id);
                    await store.simple.addPerformanceAsync({
                        id: 1,
                        name: "sample"
                    });
                });

            const results = await bench.run({ iterations: 1000, warmupIterations: 100 });
            bench.print();
            await bench.writeToTextFile();

            expect(results[0].avgTimePerOp).toBeLessThan(1);
        });

        it('Can add 10000 items under 5ms', async () => {
            const items: InferCreateType<typeof simple>[] = [];

            for (let i = 0; i < 10000; i++) {
                items.push({
                    id: i + 1,
                    name: uuid(32)
                });
            }

            const bench = createBenchmark()
                .add('Add 10000 Items', async () => {
                    const id = uuidv4();
                    const store = factory(id);
                    await store.simple.addPerformanceAsync(...items);
                });

            const results = await bench.run({ iterations: 10, warmupIterations: 50 });
            bench.print();
            await bench.writeToTextFile();

            expect(results[0].avgTimePerOp).toBeLessThan(5);
        });

        it("should query under 1.5ms", async () => {
            const bench = createBenchmark()
                .add('Query with Filter', async () => {
                    const id = uuidv4();
                    const store = factory(id);
                    await store.simple.where(x => x.name === "James" && x.id != 0).toArrayAsync();
                });

            const results = await bench.run({ iterations: 1000, warmupIterations: 100 });
            bench.print();
            await bench.writeToTextFile();

            expect(results[0].avgTimePerOp).toBeLessThan(1.5);
        })
    });

    describe('Callbacks vs Promises Performance', () => {

        it('should measure async/await performance for bulk operations', async () => {
            const items: InferCreateType<typeof simple>[] = [];

            for (let i = 0; i < 10000; i++) {
                items.push({
                    id: i + 1,
                    name: `item-${i}`
                });
            }

            const bench = createBenchmark()
                .add('Bulk Add + Save', async () => {
                    const testStore = genericFactory();
                    await testStore.simple.addAsync(...items);
                    await testStore.saveChangesAsync();
                });

            const results = await bench.run({ iterations: 10, warmupIterations: 50 });
            bench.print();
            await bench.writeToTextFile();

            expect(results[0].totalTime).toBeLessThan(5000);
        });

        it('should measure async/await performance for sequential operations', async () => {
            const bench = createBenchmark()
                .add('Sequential Add + Save', async () => {
                    const store = genericFactory();
                    for (let i = 0; i < 10; i++) {
                        await store.simple.addAsync({ id: i + 1, name: `item-${i}` });
                        await store.saveChangesAsync();
                    }
                });

            const results = await bench.run({ iterations: 10, warmupIterations: 50 });
            bench.print();
            await bench.writeToTextFile();

            expect(results[0].totalTime).toBeLessThan(2000);
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

            const bench = createBenchmark()
                .add('Query with Filter', async () => {
                    await store.simple.where(x => x.name === 'even').toArrayAsync();
                });

            const results = await bench.run({ iterations: 100, warmupIterations: 50 });
            bench.print();
            await bench.writeToTextFile();

            expect(results[0].totalTime).toBeLessThan(500);
        });

        it('should measure async/await overhead for nested operations', async () => {
            const bench = createBenchmark()
                .add('Nested Add + Query + Save', async () => {
                    const store = genericFactory();
                    for (let i = 0; i < 5; i++) {
                        await store.simple.addAsync({ id: i + 1, name: `item-${i}` });
                        await store.saveChangesAsync();
                        const result = await store.simple.where(x => x.id === i + 1).firstAsync();
                        expect(result).toBeDefined();
                    }
                });

            const results = await bench.run({ iterations: 10, warmupIterations: 50 });
            bench.print();
            await bench.writeToTextFile();

            expect(results[0].totalTime).toBeLessThan(1000);
        });

        it('should compare callback vs promise performance characteristics', async () => {
            const items: InferCreateType<typeof simple>[] = [];
            for (let i = 0; i < 100; i++) {
                items.push({ id: i + 1, name: `item-${i}` });
            }

            const bench = createBenchmark()
                .add('Async/Await - Bulk Add', async () => {
                    const store = genericFactory();
                    await store.simple.addAsync(...items);
                    await store.saveChangesAsync();
                });

            const results = await bench.run({ iterations: 50, warmupIterations: 100 });
            bench.print();
            await bench.writeToTextFile();

            logger.log(`
Performance Analysis:
===============================================
Async/Await Implementation:
  - Uses Promise-based async/await
  - Native error handling with try/catch
  - Better stack traces for debugging
  - Standard JavaScript patterns
  - Better TypeScript inference
  
Callback Implementation (theoretical):
  - Would use synchronous callback execution via TrampolinePipeline
  - No Promise overhead (no microtask queue)
  - Direct function calls
  - Potentially faster for high-frequency operations
  - But: Less readable, harder to debug, no native error handling
            `);

            expect(results[0].totalTime).toBeLessThan(2000);
        });
    });
}); 