import { CloneArrayHandler } from "./clone/CloneArrayHandler";
import { CloneDateHandler } from "./clone/CloneDateHandler";
import { CloneObjectHandler } from "./clone/CloneObjectHandler";
import { CloneValueHandler } from "./clone/CloneValueHandler";

/// Purpose: builds the handler chain for the generated clone function, which
/// deep-copies an entity so callers can never mutate stored data by reference
export class CloneHandlerBuilder {

    /**
     * @param useFromPropertyName Emit the STORAGE shape rather than the in-memory shape.
     *
     * A record that has not been read back into memory yet still carries its `from` names, so a
     * cloner generated from in-memory names would read `undefined` for every renamed property and
     * silently drop it. Passing true swaps both the reads and the writes to the storage name, which
     * gives a copier for records in that shape. Everything else about the chain is identical —
     * the same handlers, in the same order, with the same null and Date semantics.
     */
    build(useFromPropertyName: boolean = false) {
        const handler = new CloneObjectHandler();
        handler
            .setNext(new CloneDateHandler(useFromPropertyName))
            .setNext(new CloneValueHandler(useFromPropertyName))
            .setNext(new CloneArrayHandler(useFromPropertyName));

        return handler;
    }
}
