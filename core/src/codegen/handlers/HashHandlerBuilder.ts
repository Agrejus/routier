import { HashKeyHandler } from "./hash/HashKeyHandler";
import { HashValueHandler } from "./hash/HashValueHandler";
import { HashDateHandler } from "./hash/HashDateHandler";
import { HashIdentityHandler } from "./hash/HashIdentityHandler";
import { HashFunctionHandler } from "./hash/HashFunctionHandler";
import { HashComputedValueHandler } from "./hash/HashComputedValueHandler";
import { HashArrayHandler } from "./hash/HashArrayHandler";
import { HashObjectHandler } from "./hash/HashObjectHandler";
import { HashFileHandler } from "./hash/HashFileHandler";

/// Purpose:
// Should ignore Id's and Identities for type Object because we want
// to comare a new addition with what was saved in the database.
// Files are ignored for the same reason: content goes in, a reference comes back.
export class HashHandlerBuilder {

    build() {
        const handler = new HashKeyHandler();

        handler
            .setNext(new HashComputedValueHandler())
            .setNext(new HashFunctionHandler())
            .setNext(new HashIdentityHandler())
            .setNext(new HashFileHandler())
            .setNext(new HashDateHandler())
            .setNext(new HashArrayHandler())
            .setNext(new HashObjectHandler())
            .setNext(new HashValueHandler());

        return handler;
    }
}