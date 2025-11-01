import { generateData } from '@routier/test-utils';
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { IDbPlugin, uuid, uuidv4 } from '@routier/core';
import { PerformanceCapability, TracingCapability } from '@routier/core/capabilities';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';
import { SimpleBenchmark } from './utils/SimpleBenchmark';

const pluginFactory: () => IDbPlugin = () => new MemoryPlugin(uuidv4());
const stores: TestDataStore[] = [];
const factory = () => {

    const store = new TestDataStore(pluginFactory());

    stores.push(store);

    return store;
};

describe("Comments Tests", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });


    describe('Add Operations', () => {
        it("Can add item with default", async () => {
            const dataStore = factory();
            // Arrange
            const [item] = generateData(dataStore.comments.schema, 1);

            // Act
            const [added] = await dataStore.comments.addAsync(item);
            const response = await dataStore.saveChangesAsync();

            // Assert
            expect(response.aggregate.size).toBe(1);
            expect(added._id).toStrictEqual(expect.any(String));
            expect(added.author).toStrictEqual(item.author);
            expect(added.content).toBe(item.content);
            expect(added.replies).toStrictEqual(item.replies);
            expect(added.createdAt).toBe(item.createdAt);
            expect(added.createdAt).toBeDefined()
        });
    });

    it("performance timing", async () => {
        const addTimes: number[] = [];
        const saveTimes: number[] = [];
        const totalTimes: number[] = [];

        console.log('\n🚀 Running 10 benchmark iterations...\n');

        for (let i = 0; i < 10; i++) {
            const iterationStart = performance.now();
            const dataStore = factory();
            const items = generateData(dataStore.comments.schema, 100_000);

            const addResult = await SimpleBenchmark.benchmark(
                async (index) => {
                    await dataStore.comments.addAsync(items[index]);
                },
                {
                    iterations: 99_000,
                    warmupIterations: 1_000,
                    name: `Add Single Item Performance (Iteration ${i + 1})`
                }
            );

            const saveStart = performance.now();
            const saveResult = await dataStore.saveChangesAsync();
            const saveEnd = performance.now();
            const saveTime = saveEnd - saveStart;

            const iterationEnd = performance.now();
            const totalTime = iterationEnd - iterationStart;

            addTimes.push(addResult.totalTime);
            saveTimes.push(saveTime);
            totalTimes.push(totalTime);

            console.log(`Iteration ${i + 1}: Add=${addResult.totalTime.toFixed(2)}ms, Save=${saveTime.toFixed(2)}ms, Total=${totalTime.toFixed(2)}ms`);

            await dataStore.destroyAsync();
        }

        // Calculate averages
        const avgAddTime = addTimes.reduce((sum, time) => sum + time, 0) / addTimes.length;
        const avgSaveTime = saveTimes.reduce((sum, time) => sum + time, 0) / saveTimes.length;
        const avgTotalTime = totalTimes.reduce((sum, time) => sum + time, 0) / totalTimes.length;

        // Calculate standard deviation
        const addStdDev = Math.sqrt(addTimes.reduce((sum, time) => sum + Math.pow(time - avgAddTime, 2), 0) / addTimes.length);
        const saveStdDev = Math.sqrt(saveTimes.reduce((sum, time) => sum + Math.pow(time - avgSaveTime, 2), 0) / saveTimes.length);
        const totalStdDev = Math.sqrt(totalTimes.reduce((sum, time) => sum + Math.pow(time - avgTotalTime, 2), 0) / totalTimes.length);

        console.log('\n📊 Performance Summary (10 iterations):');
        console.log('='.repeat(50));
        console.log(`Add Operations:`);
        console.log(`  Average: ${avgAddTime.toFixed(2)}ms`);
        console.log(`  Std Dev: ${addStdDev.toFixed(2)}ms`);
        console.log(`  Min: ${Math.min(...addTimes).toFixed(2)}ms`);
        console.log(`  Max: ${Math.max(...addTimes).toFixed(2)}ms`);
        console.log(`Save Operations:`);
        console.log(`  Average: ${avgSaveTime.toFixed(2)}ms`);
        console.log(`  Std Dev: ${saveStdDev.toFixed(2)}ms`);
        console.log(`  Min: ${Math.min(...saveTimes).toFixed(2)}ms`);
        console.log(`  Max: ${Math.max(...saveTimes).toFixed(2)}ms`);
        console.log(`Total Time:`);
        console.log(`  Average: ${avgTotalTime.toFixed(2)}ms`);
        console.log(`  Std Dev: ${totalStdDev.toFixed(2)}ms`);
        console.log(`  Min: ${Math.min(...totalTimes).toFixed(2)}ms`);
        console.log(`  Max: ${Math.max(...totalTimes).toFixed(2)}ms`);

        // Performance analysis
        const addOpsPerSec = (9000 * 1000) / avgAddTime;
        const saveOpsPerSec = (1 * 1000) / avgSaveTime;

        console.log('\n📈 Performance Analysis:');
        console.log(`Add Operations: ${addOpsPerSec.toFixed(0)} ops/sec`);
        console.log(`Save Operations: ${saveOpsPerSec.toFixed(0)} ops/sec`);
        console.log(`Total Throughput: ${(9000 / (avgTotalTime / 1000)).toFixed(0)} ops/sec`);
    });
});