import { StripObjectHandler } from "./strip/StripObjectHandler";
import { StripValueHandler } from "./strip/StripValueHandler";
import { StripKeyHandler } from "./strip/StripKeyHandler";
import { StripIdentityHandler } from "./strip/StripIdentityHandler";
import { StripFunctionHandler } from "./strip/StripFunctionHandler";
import { StripComputedHandler } from "./strip/StripComputedHandler";

/// Purpose: builds the strip function, which returns an entity without its
/// keys, identities, and unmapped properties
export class StripHandlerBuilder {

    build() {
        const handler = new StripIdentityHandler();

        handler.setNext(new StripKeyHandler())
        .setNext(new StripFunctionHandler())
        .setNext(new StripComputedHandler())
        .setNext(new StripObjectHandler())
        .setNext(new StripValueHandler());

        return handler;
    }
}