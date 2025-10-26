import { Capability } from "./Capability";
import { PerformanceTracker } from "./performance/PerformanceTracker";
import { CallTraceManager } from "./tracing/CallTraceManager";
import { MethodInfo, MethodMetadata, MethodWrapper, PerformanceMetrics } from "./types";

export type PerformanceCapabilityOptions = {
    log?: (
        type: 'ORIGIN' | 'CHILD',
        operationId: string,
        methodName: string,
        methodPath: string,
        performanceMetrics: PerformanceMetrics
    ) => void;
    shouldLog: (methodName: string | symbol, metadata: MethodMetadata) => boolean
}

export class PerformanceCapability extends Capability {

    private callTraceManager: CallTraceManager;
    private performanceTracker: PerformanceTracker;
    private log: (
        type: 'ORIGIN' | 'CHILD',
        operationId: string,
        methodName: string,
        methodPath: string,
        performanceMetrics: PerformanceMetrics,
        isCompleted: boolean
    ) => void;
    private shouldLog?: (methodName: string | symbol, metadata: MethodMetadata) => boolean;

    constructor(options?: PerformanceCapabilityOptions) {
        super();
        this.log = options?.log ?? ((
            type: 'ORIGIN' | 'CHILD',
            operationId: string,
            methodName: string,
            methodPath: string,
            performanceMetrics: PerformanceMetrics,
            isCompleted: boolean
        ) => {

            if (isCompleted) {
                if (!performanceMetrics.duration) return;

                const deltaFromStart = this.performanceTracker.getDeltaFromOperationStart(operationId, performanceMetrics.endTime || performanceMetrics.startTime);

                console.log(`[${type} ${operationId}] ${methodName} COMPLETED`, {
                    methodPath,
                    performance: {
                        deltaFromStart: this.performanceTracker.formatDuration(deltaFromStart),
                        executionTime: this.performanceTracker.formatDuration(performanceMetrics.duration),
                        timeToNextCall: performanceMetrics.timeToNextCall ?
                            this.performanceTracker.formatDuration(performanceMetrics.timeToNextCall) : 'N/A'
                    }
                });
                return;
            }

            const deltaFromStart = this.performanceTracker.getDeltaFromOperationStart(operationId, performanceMetrics.startTime);

            console.log(`[${type} ${operationId}] ${methodName}`, {
                methodPath,
                performance: {
                    deltaFromStart: this.performanceTracker.formatDuration(deltaFromStart)
                }
            });
        });
        this.shouldLog = options?.shouldLog ?? (() => true);
        this.callTraceManager = new CallTraceManager();
        this.performanceTracker = new PerformanceTracker();
    }

    private createPerformanceInterceptor(
        originalMethod: Function,
        methodName: string,
        methodPath: string,
        instance: any
    ): Function {
        return (...args: any[]) => {
            const isNewOperation = this.callTraceManager.isNewOperation();
            let operationId: string;

            if (isNewOperation) {
                operationId = this.callTraceManager.startNewOperation();
                const startTime = this.performanceTracker.startMethodTiming(operationId, methodPath);
                this.log('ORIGIN', operationId, methodName, methodPath, { startTime }, false);
            } else {
                operationId = this.callTraceManager.getActiveOperationId();

                // Record that the previous method is about to call this one
                const callTrace = this.callTraceManager.getCurrentTrace();
                const previousMethodPath = callTrace[callTrace.length - 2];
                if (previousMethodPath) {
                    this.performanceTracker.recordNextMethodStart(operationId, previousMethodPath);
                }

                const startTime = this.performanceTracker.startMethodTiming(operationId, methodPath);
                this.log('CHILD', operationId, methodName, methodPath, { startTime }, false);
            }

            try {
                const result = originalMethod.apply(instance, args);
                return result;
            } finally {
                // End performance tracking
                const performanceMetrics = this.performanceTracker.endMethodTiming(operationId, methodPath);

                // Log completion with performance metrics
                this.log(isNewOperation ? 'ORIGIN' : 'CHILD', operationId, methodName, methodPath, performanceMetrics, true);

                if (isNewOperation) {
                    this.callTraceManager.endOperation();
                    this.performanceTracker.cleanupOperation(operationId);
                }
            }
        };
    }

    override apply(instance: unknown): void {
        if (!this.isValidObject(instance)) {
            return;
        }

        // Create a performance wrapper
        const wrapper: MethodWrapper = {
            wrapMethod: (originalMethod: Function, methodInfo: MethodInfo) => {
                return this.createPerformanceInterceptor(
                    originalMethod,
                    String(methodInfo.methodName),
                    methodInfo.methodPath.join(' → '),
                    methodInfo.instance
                );
            }
        };

        // Use the generic interception utility
        this.exploreObjectMethods(instance, (methodInfo) => {
            const originalMethod = methodInfo.instance[methodInfo.methodName].bind(methodInfo.instance);
            const wrappedMethod = wrapper.wrapMethod(originalMethod, methodInfo);
            methodInfo.instance[methodInfo.methodName] = wrappedMethod;
        }, {});
    }
}