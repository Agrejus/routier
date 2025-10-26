import { Capability } from "./Capability";
import { CallTraceManager } from "./tracing/CallTraceManager";
import { MethodInfo, MethodMetadata, MethodWrapper } from "./types";

export type TracingCapabilityOptions = {
    log?: (
        type: 'ORIGIN' | 'CHILD',
        operationId: string,
        methodName: string,
        methodPath: string,
        callTrace: string[],
        formattedCallTrace: string[],
        args: any[]
    ) => void;
    shouldLog: (methodName: string | symbol, metadata: MethodMetadata) => boolean
}

export class TracingCapability extends Capability {

    private callTraceManager: CallTraceManager;
    private log: (
        type: 'ORIGIN' | 'CHILD',
        operationId: string,
        methodName: string,
        methodPath: string,
        callTrace: string[],
        formattedCallTrace: string[],
        args: any[]
    ) => void;
    private shouldLogMethod?: (methodName: string | symbol, metadata: MethodMetadata) => boolean;

    constructor(options?: TracingCapabilityOptions) {
        super();
        this.log = options?.log ?? ((
            type: 'ORIGIN' | 'CHILD',
            operationId: string,
            methodName: string,
            methodPath: string,
            _callTrace: string[],
            formattedCallTrace: string[],
            args: any[]
        ) => {
            const stringifiedArgs = args.map(arg => this.stringifyValue(arg, 4));

            const logData: any = {
                methodPath,
                callStack: formattedCallTrace,
                args: stringifiedArgs
            };

            console.log(`[${type} ${operationId}] ${methodName}`, logData);
        });
        this.shouldLogMethod = options?.shouldLog ?? (() => true);
        this.callTraceManager = new CallTraceManager();
    }

    private createTracingInterceptor(
        originalMethod: Function,
        methodName: string,
        methodPath: string,
        instance: any
    ): Function {
        return (...args: any[]) => {
            const isNewOperation = this.callTraceManager.isNewOperation();
            let operationId: string;
            let callTrace: string[];

            if (isNewOperation) {
                operationId = this.callTraceManager.startNewOperation();
                callTrace = this.callTraceManager.addMethodToTrace(methodPath);
                const formattedCallTrace = this.callTraceManager.formatMethodPaths(callTrace);
                this.log('ORIGIN', operationId, methodName, methodPath, callTrace, formattedCallTrace, args);
            } else {
                operationId = this.callTraceManager.getActiveOperationId();
                callTrace = this.callTraceManager.addMethodToTrace(methodPath);
                const formattedCallTrace = this.callTraceManager.formatMethodPaths(callTrace);
                this.log('CHILD', operationId, methodName, methodPath, callTrace, formattedCallTrace, args);
            }

            try {
                const result = originalMethod.apply(instance, args);
                return result;
            } finally {
                if (isNewOperation) {
                    this.callTraceManager.endOperation();
                } else {
                    this.callTraceManager.removeMethodFromTrace();
                }
            }
        };
    }


    override apply(instance: unknown): void {
        if (!this.isValidObject(instance)) {
            return;
        }

        const logMethodCall = (
            type: 'ORIGIN' | 'CHILD',
            operationId: string,
            methodName: string,
            methodPath: string,
            callTrace: string[],
            formattedCallTrace: string[],
            args: any[]
        ) => {

            if (this.log) {
                this.log(type, operationId, methodName, methodPath, callTrace, formattedCallTrace, args);
                return;
            }

            const stringifiedArgs = args.map(arg => this.stringifyValue(arg, 4));

            const logData: any = {
                methodPath,
                callStack: formattedCallTrace,
                args: stringifiedArgs
            };

            console.log(`[${type} ${operationId}] ${methodName}`, logData);
        }

        // Create a tracing wrapper
        const wrapper: MethodWrapper = {
            wrapMethod: (originalMethod: Function, methodInfo: MethodInfo) => {
                const metadata: MethodMetadata = {
                    parent: methodInfo.parent,
                    instance: methodInfo.instance,
                    methodPath: methodInfo.methodPath
                };

                const shouldLog = this.shouldLogMethod(methodInfo.methodName, metadata);
                if (!shouldLog) {
                    return originalMethod; // Return unwrapped method if not logging
                }

                return this.createTracingInterceptor(
                    originalMethod,
                    String(methodInfo.methodName),
                    methodInfo.methodPath.join(' → '),
                    methodInfo.instance
                );
            }
        }

        // Use the generic interception utility
        this.exploreObjectMethods(instance, (methodInfo) => {
            const originalMethod = methodInfo.instance[methodInfo.methodName].bind(methodInfo.instance);
            const wrappedMethod = wrapper.wrapMethod(originalMethod, methodInfo);
            methodInfo.instance[methodInfo.methodName] = wrappedMethod;
        }, {});
    }
}