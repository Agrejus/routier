import { Capability } from "./Capability";
import { CallTraceManager } from "./tracing/CallTraceManager";
import { stringifyObject } from "../utilities/strings";
import { MethodInfo, MethodInfoMetadata } from "./types";
import { logger } from '../utilities';

export type TracingCapabilityOptions = {
    filter: (methodName: string | symbol, methodInfo: MethodInfo, metadata: MethodInfoMetadata) => boolean
}

export class TracingCapability extends Capability {

    private callTraceManager: CallTraceManager;
    private filter: (methodName: string | symbol, methodInfo: MethodInfo, metadata: MethodInfoMetadata) => boolean;

    constructor(options?: TracingCapabilityOptions) {
        super();
        this.filter = options?.filter ?? (() => true);
        this.callTraceManager = new CallTraceManager();
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

                    if (isNewOperation) {
                        operationId = this.callTraceManager.startNewOperation();
                        const callTrace = this.callTraceManager.addMethodToTrace(path);
                        const formattedCallTrace = this.callTraceManager.formatMethodPaths(callTrace);

                        logger.log(`\n${'═'.repeat(60)}`);
                        logger.log(`▶ ORIGIN [${operationId}] ${path}`);
                        if (args.length > 0) {
                            logger.log(`  Args:`, stringifyObject(args, 4, 0));
                        }
                        logger.log(`  Call Stack: ${formattedCallTrace.join(' → ')}`);
                    } else {
                        operationId = this.callTraceManager.getActiveOperationId();
                        const callTrace = this.callTraceManager.addMethodToTrace(path);

                        const indent = '  '.repeat(Math.min(callTrace.length - 1, 4));
                        logger.log(`${indent}└─ CHILD [${operationId}] ${path}`);
                        if (args.length > 0) {
                            logger.log(`${indent}   Args:`, stringifyObject(args, 4, 0));
                        }
                    }

                    try {
                        return originalMethod(...args);
                    } finally {
                        this.callTraceManager.removeMethodFromTrace();

                        if (isNewOperation) {
                            this.callTraceManager.endOperation();
                        }
                    }
                }
            }

        });
    }
}