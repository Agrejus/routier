import { DeserializeObjectHandler } from "./deserialize/DeserializeObjectHandler";
import { DeserializeValueHandler } from "./deserialize/DeserializeValueHandler";
import { DeserializeDateHandler } from "./deserialize/DeserializeDateHandler";
import { DeserializeComputedValueHandler } from "./deserialize/DeserializeComputedValueHandler";
import { DeserializeFunctionHandler } from "./deserialize/DeserializeFunctionHandler";

/// Purpose: 
export class DeserializeHandlerBuilder {

    build() {
        const handler = new DeserializeObjectHandler();
        handler
            .setNext(new DeserializeComputedValueHandler())
            .setNext(new DeserializeFunctionHandler())
            .setNext(new DeserializeValueHandler())
            .setNext(new DeserializeDateHandler());

        return handler;
    }
}