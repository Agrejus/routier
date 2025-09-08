import { BulkPersistResult } from "@routier/core/collections";
import type { IDbPlugin, DbPluginBulkPersistEvent, DbPluginQueryEvent, DbPluginEvent } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "@routier/core/results";

export class MyPlugin implements IDbPlugin {

    // Use the constructor to take in any plugin options
    constructor() {

    }

    query<TShape>(event: DbPluginQueryEvent<any, TShape>, done: PluginEventCallbackResult<TShape>): void {
        // Execute the event.operation against your backend and invoke the callback
        done(PluginEventResult.error(event.id, new Error("Not implemented")));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        // Persist adds/updates/removes from event.operation to your backend

        // The operation is a key value pair of schema Id + changes
        for (const [schemaId, changes] of event.operation) {
            const {
                adds,
                updates,
                hasItems,
                removes,
                tags,
                total
            } = changes;
        }

        done(PluginEventResult.error(event.id, new Error("Not implemented")));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        // Cleanup resources/connections
        done(PluginEventResult.success(event.id));
    }
}


