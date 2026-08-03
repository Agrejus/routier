import { NotApplicableHandler } from "./types";
import { SetComplexHandler } from "./set/SetComplexHandler";

export class SetHandlerBuilder {

    build() {
        const handler = new SetComplexHandler();

        handler.setNext(new NotApplicableHandler());

        return handler;
    }
}