import { CompareArrayHandler } from "./compare/CompareArrayHandler";
import { CompareComputedHandler } from "./compare/CompareComputedHandler";
import { CompareDateHandler } from "./compare/CompareDateHandler";
import { CompareFunctionHandler } from "./compare/CompareFunctionHandler";
import { CompareObjectHandler } from "./compare/CompareObjectHandler";
import { CompareValueHandler } from "./compare/CompareValueHandler";

export class CompareHandlerBuilder {

    build() {
        const handler = new CompareObjectHandler();
        handler.setNext(new CompareFunctionHandler())
            .setNext(new CompareComputedHandler())
            .setNext(new CompareArrayHandler())
            .setNext(new CompareDateHandler())
            .setNext(new CompareValueHandler());

        return handler;
    }
}