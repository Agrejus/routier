import { Capability } from "./Capability";
import { PerformanceTracker } from "./performance/PerformanceTracker";
import { CallTraceManager } from "./tracing/CallTraceManager";
import { MethodInfoMetadata, MethodInfo } from "./types";
import { logger } from '../utilities';
import fs from 'node:fs';
import path from 'node:path';

export type BenchmarkCapabilityOptions = {
    filter: (methodName: string | symbol, methodInfo: MethodInfo, metadata: MethodInfoMetadata) => boolean
}

type MethodStats = {
    path: string;
    callCount: number;
    totalTime: number;
    minTime: number;
    maxTime: number;
    times: number[];
    children: Map<string, MethodStats>;
}

export class BenchmarkCapability extends Capability {

    private callTraceManager: CallTraceManager;
    private performanceTracker: PerformanceTracker;
    private filter: (methodName: string | symbol, methodInfo: MethodInfo, metadata: MethodInfoMetadata) => boolean;
    private childDurations: Map<string, number[]> = new Map();
    private methodStats: Map<string, MethodStats> = new Map();
    private operationStats: Map<string, { path: string; totalTime: number; childTime: number; overhead: number }> = new Map();

    constructor(options?: BenchmarkCapabilityOptions) {
        super();
        this.filter = options?.filter ?? (() => true)
        this.callTraceManager = new CallTraceManager();
        this.performanceTracker = new PerformanceTracker();
    }

    override apply(instance: unknown): void {

        this.explore(instance, (meta, info) => {

            if (info.isCallable) {
                const originalMethod = meta.instance[info.name].bind(meta.instance);

                meta.instance[info.name] = (...args: any[]) => {

                    const path = `${meta.path!}.${String(info.name)}()`;

                    if (this.filter(path, info, meta) === false) {
                        return originalMethod(...args);
                    }

                    const isNewOperation = this.callTraceManager.isNewOperation();
                    let operationId: string;
                    let callTrace: string[];
                    let depth: number;

                    if (isNewOperation) {
                        operationId = this.callTraceManager.startNewOperation();
                        this.childDurations.set(operationId, []);
                        callTrace = this.callTraceManager.addMethodToTrace(path);
                        depth = callTrace.length - 1;

                        this.performanceTracker.startMethodTiming(operationId, path);
                    } else {
                        operationId = this.callTraceManager.getActiveOperationId();
                        callTrace = this.callTraceManager.addMethodToTrace(path);
                        depth = callTrace.length - 1;

                        // Track children for this child method too
                        const childMethodKey = `${operationId}:${path}`;
                        this.childDurations.set(childMethodKey, []);

                        this.performanceTracker.startMethodTiming(operationId, path);
                    }

                    try {
                        return originalMethod(...args);
                    } finally {
                        const metrics = this.performanceTracker.endMethodTiming(operationId, path);
                        const duration = metrics.duration ?? 0;

                        // Store method statistics
                        let stats = this.methodStats.get(path);
                        if (!stats) {
                            stats = {
                                path,
                                callCount: 0,
                                totalTime: 0,
                                minTime: Infinity,
                                maxTime: 0,
                                times: [],
                                children: new Map()
                            };
                            this.methodStats.set(path, stats);
                        }

                        stats.callCount++;
                        stats.totalTime += duration;
                        stats.minTime = Math.min(stats.minTime, duration);
                        stats.maxTime = Math.max(stats.maxTime, duration);
                        stats.times.push(duration);

                        if (isNewOperation) {
                            const childDurations = this.childDurations.get(operationId) ?? [];
                            const totalChildTime = childDurations.reduce((sum, d) => sum + d, 0);
                            const overhead = duration - totalChildTime;

                            // Store operation statistics
                            this.operationStats.set(operationId, {
                                path,
                                totalTime: duration,
                                childTime: totalChildTime,
                                overhead: Math.max(0, overhead)
                            });

                            this.childDurations.delete(operationId);
                            this.performanceTracker.cleanupOperation(operationId);
                            this.callTraceManager.endOperation();
                        } else {
                            const childMethodKey = `${operationId}:${path}`;
                            const childDurations = this.childDurations.get(childMethodKey) ?? [];
                            const totalChildTime = childDurations.reduce((sum, d) => sum + d, 0);
                            const overhead = duration - totalChildTime;

                            // Clean up child method tracking
                            this.childDurations.delete(childMethodKey);

                            // Find the parent method and add this duration to its children list
                            const currentTrace = this.callTraceManager.getCurrentTrace();
                            if (currentTrace.length > 1) {
                                const parentPath = currentTrace[currentTrace.length - 2];

                                if (currentTrace.length === 2) {
                                    // Direct child of root - add to root's children list
                                    const rootChildDurations = this.childDurations.get(operationId);
                                    if (rootChildDurations) {
                                        rootChildDurations.push(duration);
                                    }
                                } else {
                                    // Nested child - add to parent method's children list
                                    const parentMethodKey = `${operationId}:${parentPath}`;
                                    const parentChildDurations = this.childDurations.get(parentMethodKey);
                                    if (parentChildDurations) {
                                        parentChildDurations.push(duration);
                                    }
                                }
                            }
                        }

                        this.callTraceManager.removeMethodFromTrace();
                    }
                }
            }
        });
    }

    print(): void {
        if (this.methodStats.size === 0) {
            logger.log('No benchmark results to display');
            return;
        }

        logger.log('\n📊 Benchmark Results');
        logger.log('='.repeat(80));

        // Convert Map to array and sort by total time (descending)
        const statsArray = Array.from(this.methodStats.values())
            .sort((a, b) => b.totalTime - a.totalTime);

        statsArray.forEach((stats, index) => {
            const avgTime = stats.totalTime / stats.callCount;
            const opsPerSecond = 1000 / avgTime;

            logger.log(`\n${index + 1}. ${stats.path}:`);
            logger.log(`   Call count:     ${stats.callCount.toLocaleString()}`);
            logger.log(`   Total time:     ${stats.totalTime.toFixed(3)}ms`);
            logger.log(`   Avg time/call:  ${avgTime.toFixed(6)}ms`);
            logger.log(`   Min time:       ${stats.minTime.toFixed(6)}ms`);
            logger.log(`   Max time:       ${stats.maxTime.toFixed(6)}ms`);
            logger.log(`   Ops/sec:        ${opsPerSecond.toFixed(0)}`);
        });

        if (statsArray.length > 1) {
            const fastest = statsArray.reduce((fastest, current) => {
                const fastestAvg = fastest.totalTime / fastest.callCount;
                const currentAvg = current.totalTime / current.callCount;
                return currentAvg < fastestAvg ? current : fastest;
            });
            const slowest = statsArray.reduce((slowest, current) => {
                const slowestAvg = slowest.totalTime / slowest.callCount;
                const currentAvg = current.totalTime / current.callCount;
                return currentAvg > slowestAvg ? current : slowest;
            });

            const fastestAvg = fastest.totalTime / fastest.callCount;
            const slowestAvg = slowest.totalTime / slowest.callCount;
            const ratio = slowestAvg / fastestAvg;

            logger.log('\n📈 Comparison:');
            logger.log(`   Fastest:        ${fastest.path} (${fastestAvg.toFixed(6)}ms/call)`);
            logger.log(`   Slowest:        ${slowest.path} (${slowestAvg.toFixed(6)}ms/call)`);
            logger.log(`   Performance:    ${ratio.toFixed(2)}x difference`);
        }

        logger.log('\n' + '='.repeat(80) + '\n');
    }

    reset(): this {
        this.methodStats.clear();
        this.operationStats.clear();
        this.childDurations.clear();
        return this;
    }

    getResults(): MethodStats[] {
        return Array.from(this.methodStats.values());
    }

    async writeToTextFile(filePath?: string): Promise<string> {
        if (this.methodStats.size === 0) {
            throw new Error('No benchmark results to write. Run code with capability applied first.');
        }

        const defaultPath = path.join(process.cwd(), 'benchmark-results.txt');
        const outputPath = filePath || defaultPath;

        const statsArray = Array.from(this.methodStats.values())
            .sort((a, b) => b.totalTime - a.totalTime);

        let output = `\n${'='.repeat(80)}\n`;
        output += `Benchmark Capability Results\n`;
        output += `Generated: ${new Date().toISOString()}\n`;
        output += '='.repeat(80) + '\n\n';

        statsArray.forEach((stats, index) => {
            const avgTime = stats.totalTime / stats.callCount;
            const opsPerSecond = 1000 / avgTime;

            output += `${index + 1}. ${stats.path}:\n`;
            output += `   Call count:     ${stats.callCount.toLocaleString()}\n`;
            output += `   Total time:     ${stats.totalTime.toFixed(3)}ms\n`;
            output += `   Avg time/call:  ${avgTime.toFixed(6)}ms\n`;
            output += `   Min time:       ${stats.minTime.toFixed(6)}ms\n`;
            output += `   Max time:       ${stats.maxTime.toFixed(6)}ms\n`;
            output += `   Ops/sec:        ${opsPerSecond.toFixed(0)}\n`;
            output += '\n';
        });

        if (statsArray.length > 1) {
            const fastest = statsArray.reduce((fastest, current) => {
                const fastestAvg = fastest.totalTime / fastest.callCount;
                const currentAvg = current.totalTime / current.callCount;
                return currentAvg < fastestAvg ? current : fastest;
            });
            const slowest = statsArray.reduce((slowest, current) => {
                const slowestAvg = slowest.totalTime / slowest.callCount;
                const currentAvg = current.totalTime / current.callCount;
                return currentAvg > slowestAvg ? current : slowest;
            });

            const fastestAvg = fastest.totalTime / fastest.callCount;
            const slowestAvg = slowest.totalTime / slowest.callCount;
            const ratio = slowestAvg / fastestAvg;

            output += 'Comparison:\n';
            output += `   Fastest:        ${fastest.path} (${fastestAvg.toFixed(6)}ms/call)\n`;
            output += `   Slowest:        ${slowest.path} (${slowestAvg.toFixed(6)}ms/call)\n`;
            output += `   Performance:    ${ratio.toFixed(2)}x difference\n`;
        }

        output += '='.repeat(80) + '\n';

        await fs.promises.appendFile(outputPath, output, 'utf8');

        logger.log(`\n💾 Benchmark results appended to: ${outputPath}\n`);

        return outputPath;
    }
}