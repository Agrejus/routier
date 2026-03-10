import {
  IDbPlugin,
  DbPluginQueryEvent,
  DbPluginBulkPersistEvent,
  DbPluginEvent,
  ITranslatedValue,
} from "@routier/core/plugins";
import {
  PluginEventCallbackResult,
  PluginEventCallbackPartialResult,
  PluginEventResult,
} from "@routier/core/results";
import { BulkPersistResult } from "@routier/core/collections";
import { JsonTranslator } from "@routier/core/plugins/translators";

export class MyCustomPlugin implements IDbPlugin {
  private options: any;

  constructor(options: any) {
    this.options = options;
  }

  query<TRoot extends {}, TShape>(
    event: DbPluginQueryEvent<TRoot, TShape>,
    done: PluginEventCallbackResult<ITranslatedValue<TShape>>
  ): void {
    // Translate event.operation to your backend's query format
    // Execute the query and use a translator to wrap results in ITranslatedValue
    const translator = new JsonTranslator(event.operation);
    const results: unknown[] = []; // Your query results here

    // translate() automatically wraps results in ITranslatedValue to allow
    // iteration (for grouped queries) and change tracking
    const translatedValue = translator.translate(results);
    done(PluginEventResult.success(event.id, translatedValue));
  }

  bulkPersist(
    event: DbPluginBulkPersistEvent,
    done: PluginEventCallbackPartialResult<BulkPersistResult>
  ): void {
    // event.operation contains ALL collections/views with changes
    // You decide how to handle each schema's adds/updates/removes
    const result = event.operation.toResult();

    for (const [schemaId, changes] of event.operation) {
      // Iterate through each schema's changes
      const { adds, updates, removes, hasItems } = changes;
      if (!hasItems) continue;

      // Get schema for this collection
      const schema = event.schemas.get(schemaId);

      // Process adds, updates, removes for this schema
    }

    done(PluginEventResult.success(event.id, result));
  }

  destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
    // Clean up resources, close connections
    done(PluginEventResult.success(event.id));
  }
}