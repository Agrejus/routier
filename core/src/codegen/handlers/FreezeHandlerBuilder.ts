import { FreezePrimitiveValueHandler } from "./freeze/FreezePrimitiveValueHandler";
import { FreezeObjectHandler } from "./freeze/FreezeObjectHandler";
import { FreezeArrayHandler } from "./freeze/FreezeArrayHandler";

/// Purpose:
export class FreezeHandlerBuilder {

    build() {
        const handler = new FreezeObjectHandler();
        handler.setNext(new FreezeArrayHandler()).setNext(new FreezePrimitiveValueHandler());

        return handler;
    }
}