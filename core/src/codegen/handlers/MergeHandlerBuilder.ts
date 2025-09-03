import { MergeDefaultFunctionHandler } from "./merge/MergeDefaultFunctionHandler";
import { MergePrimitiveHandler } from "./merge/MergePrimitiveHandler";
import { MergeComputedValueHandler } from "./merge/MergeComputedValueHandler";
import { MergeDefaultValueHandler } from "./merge/MergeDefaultValueHandler";
import { MergeFunctionHandler } from "./merge/MergeFunctionHandler";

/// Purpose: Should recompute computed properties
export class MergeHandlerBuilder {

    build() {
        const handler = new MergeDefaultFunctionHandler();
        handler.setNext(new MergeDefaultValueHandler())
            .setNext(new MergeFunctionHandler())
            .setNext(new MergeComputedValueHandler())
            .setNext(new MergePrimitiveHandler());

        return handler;
    }
}