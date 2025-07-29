import { FreezePrimitiveValueHandler } from "./freeze/FreezePrimitiveValueHandler";
import { FreezeObjectHandler } from "./freeze/FreezeObjectHandler";

/// Purpose: 
export class FreezeHandlerBuilder {

    build() {
        const handler = new FreezeObjectHandler();
        handler.setNext(new FreezePrimitiveValueHandler());

        return handler;
    }
}