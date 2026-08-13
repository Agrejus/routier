import { MergeDefaultFunctionHandler } from "./merge/MergeDefaultFunctionHandler";
import { MergeObjectHandler } from "./merge/MergeObjectHandler";
import { MergePrimitiveHandler } from "./merge/MergePrimitiveHandler";
import { MergeComputedValueHandler } from "./merge/MergeComputedValueHandler";
import { MergeDefaultValueHandler } from "./merge/MergeDefaultValueHandler";
import { MergeFunctionHandler } from "./merge/MergeFunctionHandler";
import { MergeArrayHandler } from "./merge/MergeArrayHandler";

/// Purpose: Should recompute computed properties
export class MergeHandlerBuilder {

    build() {
        const handler = new MergeDefaultFunctionHandler();
        handler.setNext(new MergeDefaultValueHandler())
            .setNext(new MergeFunctionHandler())
            .setNext(new MergeComputedValueHandler())
            // Before the primitive handler: arrays would otherwise fall through to its
            // reference copy, which discards the destination array's tracking proxy
            .setNext(new MergeArrayHandler())
            .setNext(new MergePrimitiveHandler())
            .setNext(new MergeObjectHandler());

        return handler;
    }
}