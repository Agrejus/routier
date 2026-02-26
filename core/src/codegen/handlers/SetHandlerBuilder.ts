import { SetComplexHandler } from "./set/SetComplexHandler";

export class SetHandlerBuilder {

    build() {
        const handler = new SetComplexHandler();

        return handler;
    }
}