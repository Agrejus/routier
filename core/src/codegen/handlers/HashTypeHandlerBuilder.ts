import { NotApplicableHandler } from "./types";
import { HashTypeValueHandler } from "./hashType/HashTypeValueHandler";

/// Purpose: 
export class HashTypeHandlerBuilder {

    build() {
        const handler = new HashTypeValueHandler();

        handler.setNext(new NotApplicableHandler());

        return handler;
    }
}