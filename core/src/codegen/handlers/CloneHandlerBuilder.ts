import { CloneArrayHandler } from "./clone/CloneArrayHandler";
import { CloneDateHandler } from "./clone/CloneDateHandler";
import { CloneObjectHandler } from "./clone/CloneObjectHandler";
import { CloneValueHandler } from "./clone/CloneValueHandler";

/// Purpose: builds the handler chain for the generated clone function, which
/// deep-copies an entity so callers can never mutate stored data by reference
export class CloneHandlerBuilder {

    build() {
        const handler = new CloneObjectHandler();
        handler
            .setNext(new CloneDateHandler())
            .setNext(new CloneValueHandler())
            .setNext(new CloneArrayHandler());

        return handler;
    }
}