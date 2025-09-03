import { PrepareIdentityHandler } from "./prepare/PrepareIdentityHandler";
import { PrepareKeyHandler } from "./prepare/PrepareKeyHandler";
import { PrepareValueHandler } from "./prepare/PrepareValueHandler";
import { PrepareObjectHandler } from "./prepare/PrepareObjectHandler";
import { PrepareComputedValueHandler } from "./prepare/PrepareComputedValueHandler";
import { PrepareFunctionHandler } from "./prepare/PrepareFunctionHandler";

/// Purpose: Called before we save entities to the database.  Responsible for cleaning up
/// an entity before it is sent to the plugin
export class PrepareHandlerBuilder {

    build() {
        const handler = new PrepareIdentityHandler();
        handler
            .setNext(new PrepareFunctionHandler())
            .setNext(new PrepareComputedValueHandler())
            .setNext(new PrepareKeyHandler())
            .setNext(new PrepareObjectHandler())
            .setNext(new PrepareValueHandler());

        return handler;
    }
}