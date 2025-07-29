import { SerializeDateHandler } from "./serialize/SerializeDateHandler";
import { SerializeObjectHandler } from "./serialize/SerializeObjectHandler";
import { SerializeValueHandler } from "./serialize/SerializeValueHandler";

/// Purpose: 
export class SerializeHandlerBuilder {

    build() {
        const handler = new SerializeDateHandler();
        handler.setNext(new SerializeValueHandler())
            .setNext(new SerializeObjectHandler());

        return handler;
    }
}