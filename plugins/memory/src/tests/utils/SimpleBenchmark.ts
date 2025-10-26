import { performance } from 'perf_hooks';

export interface BenchmarkResult {
    name: string;
    totalTime: number;
    iterations: number;
    avgTimePerOp: number;
    opsPerSecond: number;
    warmupTime?: number;
}

export interface BenchmarkOptions {
    iterations?: number;
    warmupIterations?: number;
    name?: string;
}

export class SimpleBenchmark {
    /**
     * Benchmark a function with warmup and timing
     * The function receives an index parameter for each iteration
     */
    static async benchmark<T>(
        fn: (index: number) => Promise<T> | T,
        options: BenchmarkOptions = {}
    ): Promise<BenchmarkResult> {
        const {
            iterations = 100_000,
            warmupIterations = 1000,
            name = 'Benchmark'
        } = options;

        // Warm up
        const warmupStart = performance.now();
        for (let i = 0; i < warmupIterations; i++) {
            await fn(i);
        }
        const warmupEnd = performance.now();
        const warmupTime = warmupEnd - warmupStart;

        // Benchmark
        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
            await fn(i);
        }
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const avgTimePerOp = (totalTime / iterations) * 1000; // Convert to microseconds
        const opsPerSecond = 1000 / (totalTime / iterations);

        return {
            name,
            totalTime,
            iterations,
            avgTimePerOp,
            opsPerSecond,
            warmupTime
        };
    }

    /**
     * Benchmark multiple functions and compare them
     * Each function receives an index parameter for each iteration
     */
    static async compare<T>(
        benchmarks: Array<{ name: string; fn: (index: number) => Promise<T> | T }>,
        options: BenchmarkOptions = {}
    ): Promise<BenchmarkResult[]> {
        const results: BenchmarkResult[] = [];

        for (const benchmark of benchmarks) {
            const result = await this.benchmark(benchmark.fn, {
                ...options,
                name: benchmark.name
            });
            results.push(result);
        }

        return results;
    }

    /**
     * Print benchmark results in a nice format
     */
    static printResults(results: BenchmarkResult | BenchmarkResult[]): void {
        const resultsArray = Array.isArray(results) ? results : [results];

        console.log('\n📊 Benchmark Results:');
        console.log('='.repeat(50));

        resultsArray.forEach(result => {
            console.log(`\n${result.name}:`);
            console.log(`  Total time: ${result.totalTime.toFixed(2)}ms`);
            console.log(`  Iterations: ${result.iterations.toLocaleString()}`);
            console.log(`  Avg time per operation: ${result.avgTimePerOp.toFixed(4)}μs`);
            console.log(`  Operations per second: ${result.opsPerSecond.toFixed(0)}`);

            if (result.warmupTime) {
                console.log(`  Warmup time: ${result.warmupTime.toFixed(2)}ms`);
            }
        });

        // Performance analysis for multiple results
        if (resultsArray.length > 1) {
            console.log('\n📈 Performance Comparison:');
            const fastest = resultsArray.reduce((min, result) =>
                result.avgTimePerOp < min.avgTimePerOp ? result : min
            );
            const slowest = resultsArray.reduce((max, result) =>
                result.avgTimePerOp > max.avgTimePerOp ? result : max
            );

            console.log(`  Fastest: ${fastest.name} (${fastest.avgTimePerOp.toFixed(2)}μs)`);
            console.log(`  Slowest: ${slowest.name} (${slowest.avgTimePerOp.toFixed(2)}μs)`);
            console.log(`  Performance ratio: ${(slowest.avgTimePerOp / fastest.avgTimePerOp).toFixed(2)}x`);
        }
    }

    /**
     * Print results as a table (if console.table is available)
     */
    static printTable(results: BenchmarkResult[]): void {
        if (typeof console.table === 'function') {
            console.log('\n📊 Benchmark Results Table:');
            console.table(results.map(result => ({
                'Name': result.name,
                'Total Time (ms)': result.totalTime.toFixed(2),
                'Iterations': result.iterations.toLocaleString(),
                'Avg Time (μs)': result.avgTimePerOp.toFixed(4),
                'Ops/sec': result.opsPerSecond.toFixed(0),
                'Warmup (ms)': result.warmupTime?.toFixed(2) || 'N/A'
            })));
        } else {
            this.printResults(results);
        }
    }
}

// Convenience functions for quick benchmarking
export const benchmark = SimpleBenchmark.benchmark;
export const compare = SimpleBenchmark.compare;
export const printResults = SimpleBenchmark.printResults;
export const printTable = SimpleBenchmark.printTable;
