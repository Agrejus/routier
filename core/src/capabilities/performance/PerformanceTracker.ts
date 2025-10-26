import { PerformanceMetrics } from "../types";

export class PerformanceTracker {
    private methodTimings = new Map<string, { startTime: number; nextMethodStartTime?: number }>();
    private operationStartTimes = new Map<string, number>();

    startMethodTiming(operationId: string, methodPath: string): number {
        const startTime = performance.now();
        const key = `${operationId}:${methodPath}`;

        // Track operation start time for delta calculations
        if (!this.operationStartTimes.has(operationId)) {
            this.operationStartTimes.set(operationId, startTime);
        }

        this.methodTimings.set(key, { startTime });
        return startTime;
    }

    recordNextMethodStart(operationId: string, methodPath: string): void {
        const key = `${operationId}:${methodPath}`;
        const timing = this.methodTimings.get(key);
        if (timing) {
            timing.nextMethodStartTime = performance.now();
        }
    }

    endMethodTiming(operationId: string, methodPath: string): PerformanceMetrics {
        const endTime = performance.now();
        const key = `${operationId}:${methodPath}`;
        const timing = this.methodTimings.get(key);

        if (!timing) {
            return { startTime: endTime };
        }

        const duration = endTime - timing.startTime;
        const timeToNextCall = timing.nextMethodStartTime ?
            timing.nextMethodStartTime - timing.startTime : undefined;

        // Clean up
        this.methodTimings.delete(key);

        return {
            startTime: timing.startTime,
            endTime,
            duration,
            nextMethodStartTime: timing.nextMethodStartTime,
            timeToNextCall
        };
    }

    formatDuration(milliseconds: number): string {
        if (milliseconds < 1) {
            return `${(milliseconds * 1000).toFixed(1)}μs`;
        } else if (milliseconds < 1000) {
            return `${milliseconds.toFixed(2)}ms`;
        } else {
            return `${(milliseconds / 1000).toFixed(2)}s`;
        }
    }

    getDeltaFromOperationStart(operationId: string, currentTime: number): number {
        const operationStartTime = this.operationStartTimes.get(operationId);
        return operationStartTime ? currentTime - operationStartTime : 0;
    }

    cleanupOperation(operationId: string): void {
        this.operationStartTimes.delete(operationId);
    }
}