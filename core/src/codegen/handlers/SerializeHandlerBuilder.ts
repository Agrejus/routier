import { SerializeDateHandler } from "./serialize/SerializeDateHandler";
import { SerializeObjectHandler } from "./serialize/SerializeObjectHandler";
import { SerializeValueHandler } from "./serialize/SerializeValueHandler";
import { SerializeSerializerHandler } from "./serialize/SerializeSerializerHandler";
import { SerializeFunctionHandler } from "./serialize/SerializeFunctionHandler";
import { SerializeComputedHandler } from "./serialize/SerializeComputedHandler";

/// Purpose: 
export class SerializeHandlerBuilder {

    build() {
        const handler = new SerializeSerializerHandler();
        handler
            .setNext(new SerializeComputedHandler())
            .setNext(new SerializeFunctionHandler())
            .setNext(new SerializeDateHandler())
            .setNext(new SerializeValueHandler())
            .setNext(new SerializeObjectHandler());

        return handler;
    }
}