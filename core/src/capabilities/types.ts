export type MethodInfoMetadata = { parent?: MethodInfoMetadata, instance: Record<string | symbol, any>, propertyName: string | symbol, path?: string };
export type MethodInfo = { name: string | symbol, isCallable: boolean; }

export interface PerformanceMetrics {
    readonly startTime: number;
    readonly endTime?: number;
    readonly duration?: number;
    readonly nextMethodStartTime?: number;
    readonly timeToNextCall?: number;
}