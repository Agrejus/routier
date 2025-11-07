import { BulkPersistResult } from "@routier/core/collections";
import type { IDbPlugin, DbPluginBulkPersistEvent, DbPluginQueryEvent, DbPluginEvent, ITranslatedValue } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "@routier/core/results";
import { JsonTranslator } from "@routier/core/plugins/translators";

export class MyPlugin implements IDbPlugin {

    // Use the constructor to take in any plugin options
    constructor() {

    }

    query<TShape>(event: DbPluginQueryEvent<any, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        // Execute the event.operation against your backend and invoke the callback
        // Use a translator to wrap results in ITranslatedValue (allows iteration for grouped queries
        // and determines if change tracking should be enabled)
        const translator = new JsonTranslator(event.operation);
        const results: unknown[] = []; // Your query results here

        // translate() automatically wraps results in ITranslatedValue
        const translatedValue = translator.translate(results);
        done(PluginEventResult.success(event.id, translatedValue));
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


