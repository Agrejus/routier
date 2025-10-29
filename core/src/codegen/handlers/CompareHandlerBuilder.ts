import { CompareArrayHandler } from "./compare/CompareArrayHandler";
import { CompareDateHandler } from "./compare/CompareDateHandler";
import { CompareObjectHandler } from "./compare/CompareObjectHandler";
import { CompareValueHandler } from "./compare/CompareValueHandler";

export class CompareHandlerBuilder {

    build() {
        const handler = new CompareObjectHandler();
        handler.setNext(new CompareArrayHandler())
            .setNext(new CompareDateHandler())
            .setNext(new CompareValueHandler());

        return handler;
    }
}