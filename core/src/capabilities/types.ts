export interface MethodInfo {
    readonly methodName: string | symbol;
    readonly instance: any;
    readonly methodPath: string[];
    readonly parent: any;
}

export interface ExplorationOptions {
    readonly maxDepth?: number;
    readonly includeNonEnumerable?: boolean;
    readonly filter?: (methodInfo: MethodInfo) => boolean;
}

export interface MethodWrapper {
    readonly wrapMethod: (originalMethod: Function, methodInfo: MethodInfo) => Function;
}

export interface MethodMetadata {
    readonly parent: any | null;
    readonly instance: any;
    readonly methodPath: string[];
}

export interface PerformanceMetrics {
    readonly startTime: number;
    readonly endTime?: number;
    readonly duration?: number;
    readonly nextMethodStartTime?: number;
    readonly timeToNextCall?: number;
}