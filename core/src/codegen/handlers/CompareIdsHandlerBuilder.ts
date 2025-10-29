import { CompareIdsKeyHandler } from "./compareIds/CompareIdsKeyHandler";

export class CompareIdsHandlerBuilder {

    build() {
        const handler = new CompareIdsKeyHandler();

        return handler;
    }
}