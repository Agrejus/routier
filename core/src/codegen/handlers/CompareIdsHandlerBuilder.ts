import { NotApplicableHandler } from "./types";
import { CompareIdsKeyHandler } from "./compareIds/CompareIdsKeyHandler";

export class CompareIdsHandlerBuilder {

    build() {
        const handler = new CompareIdsKeyHandler();

        handler.setNext(new NotApplicableHandler());

        return handler;
    }
}