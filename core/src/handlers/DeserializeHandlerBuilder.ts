import { DeserializeObjectHandler } from "./deserialize/DeserializeObjectHandler";
import { DeserializeValueHandler } from "./deserialize/DeserializeValueHandler";
import { DeserializeDateHandler } from "./deserialize/DeserializeDateHandler";

/// Purpose: 
export class DeserializeHandlerBuilder {

    build() {
        const handler = new DeserializeObjectHandler();
        handler.setNext(new DeserializeValueHandler())
            .setNext(new DeserializeDateHandler());

        return handler;
    }
}