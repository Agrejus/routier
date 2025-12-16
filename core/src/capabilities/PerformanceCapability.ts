import { stringifyObject } from "../utilities";
import { Capability } from "./Capability";
import { PerformanceTracker } from "./performance/PerformanceTracker";
import { CallTraceManager } from "./tracing/CallTraceManager";
import { MethodInfoMetadata, MethodInfo } from "./types";
import { logger } from '../utilities';

export type PerformanceCapabilityOptions = {
    filter: (methodName: string | symbol, methodInfo: MethodInfo, metadata: MethodInfoMetadata) => boolean
}

export class PerformanceCapability extends Capability {

    private callTraceManager: CallTraceManager;
    private performanceTracker: PerformanceTracker;
    private filter: (methodName: string | symbol, methodInfo: MethodInfo, metadata: MethodInfoMetadata) => boolean;
    private childDurations: Map<string, number[]> = new Map();

    constructor(options?: PerformanceCapabilityOptions) {
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
                        const formattedCallTrace = this.callTraceManager.formatMethodPaths(callTrace);

                        this.performanceTracker.startMethodTiming(operationId, path);

                        logger.log(`\n${'═'.repeat(60)}`);
                        logger.log(`▶ ORIGIN [${operationId}] ${path}`);
                        if (args.length > 0) {
                            logger.log(`  Args:`, stringifyObject(args, 4, 0));
                        }
                        logger.log(`  Call Stack: ${formattedCallTrace.join(' → ')}`);
                    } else {
                        operationId = this.callTraceManager.getActiveOperationId();
                        callTrace = this.callTraceManager.addMethodToTrace(path);
                        depth = callTrace.length - 1;
                        const indent = '  '.repeat(Math.min(depth, 4));

                        // Track children for this child method too
                        const childMethodKey = `${operationId}:${path}`;
                        this.childDurations.set(childMethodKey, []);

                        this.performanceTracker.startMethodTiming(operationId, path);

                        logger.log(`${indent}└─ CHILD [${operationId}] ${path}`);
                        if (args.length > 0) {
                            logger.log(`${indent}   Args:`, stringifyObject(args, 4, 0));
                        }
                    }

                    try {
                        return originalMethod(...args);
                    } finally {
                        const metrics = this.performanceTracker.endMethodTiming(operationId, path);
                        const duration = metrics.duration ?? 0;
                        const formattedDuration = this.performanceTracker.formatDuration(duration);

                        if (isNewOperation) {
                            const childDurations = this.childDurations.get(operationId) ?? [];
                            const totalChildTime = childDurations.reduce((sum, d) => sum + d, 0);
                            const formattedTotalChildTime = this.performanceTracker.formatDuration(totalChildTime);
                            const overhead = duration - totalChildTime;
                            const formattedOverhead = this.performanceTracker.formatDuration(Math.max(0, overhead));

                            logger.log(`\n${'═'.repeat(60)}`);
                            logger.log(`◀ COMPLETE [${operationId}] ${path}`);
                            logger.log(`  Total Duration: ${formattedDuration}`);
                            if (childDurations.length > 0) {
                                logger.log(`  Children Duration: ${formattedTotalChildTime} (${childDurations.length} calls)`);
                                logger.log(`  Overhead: ${formattedOverhead}`);
                            }
                            logger.log(`${'═'.repeat(60)}\n`);

                            this.childDurations.delete(operationId);
                            this.performanceTracker.cleanupOperation(operationId);
                            this.callTraceManager.endOperation();
                        } else {
                            const indent = '  '.repeat(Math.min(depth, 4));
                            const childMethodKey = `${operationId}:${path}`;
                            const childDurations = this.childDurations.get(childMethodKey) ?? [];
                            const totalChildTime = childDurations.reduce((sum, d) => sum + d, 0);
                            const formattedTotalChildTime = this.performanceTracker.formatDuration(totalChildTime);
                            const overhead = duration - totalChildTime;
                            const formattedOverhead = this.performanceTracker.formatDuration(Math.max(0, overhead));

                            logger.log(`${indent}   ✓ ${formattedDuration}`);
                            if (childDurations.length > 0) {
                                logger.log(`${indent}     Children: ${formattedTotalChildTime} (${childDurations.length} calls), Overhead: ${formattedOverhead}`);
                            }

                            // Clean up child method tracking
                            this.childDurations.delete(childMethodKey);

                            // Find the parent method and add this duration to its children list
                            // The parent is the method one level up in the call trace
                            const currentTrace = this.callTraceManager.getCurrentTrace();
                            if (currentTrace.length > 1) {
                                // Parent is the second-to-last item in the trace (before we remove current)
                                const parentPath = currentTrace[currentTrace.length - 2];

                                // Check if parent is the root operation (trace length 2 means root + this child)
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
}