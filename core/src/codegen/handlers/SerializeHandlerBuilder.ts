import { SerializeDateHandler } from "./serialize/SerializeDateHandler";
import { SerializeObjectHandler } from "./serialize/SerializeObjectHandler";
import { SerializeValueHandler } from "./serialize/SerializeValueHandler";
import { SerializeSerializerHandler } from "./serialize/SerializeSerializerHandler";

/// Purpose: 
export class SerializeHandlerBuilder {

    build() {
        const handler = new SerializeSerializerHandler();
        handler
            .setNext(new SerializeDateHandler())
            .setNext(new SerializeValueHandler())
            .setNext(new SerializeObjectHandler());

        return handler;
    }
}