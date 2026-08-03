import { NotApplicableHandler } from "./types";
import { IdSelectorValueHandler } from "./idSelector/IdSelectorValueHandler";
/// Purpose: 
export class IdSelectorHandlerBuilder {

    build() {
        const handler = new IdSelectorValueHandler();

        handler.setNext(new NotApplicableHandler());

        return handler;
    }
}