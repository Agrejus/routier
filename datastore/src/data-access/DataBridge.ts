import { DatabaseDataAccessStrategy } from "./strategies/DatabaseDataAccessStrategy";
import { IDataAccessStrategy } from "./types";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue } from "@routier/core/plugins";
import { PluginEventCallbackResult, Result } from "@routier/core/results";
import { BulkPersistResult } from "@routier/core/collections";
import { logger, uuid, uuidv4 } from "@routier/core/utilities";
import { CompiledSchema } from "@routier/core/schema";

// Use a data bridge so we can abstract away some of the stuff
// a new collection should not need to worry about
export class DataBridge<T extends {}> {

    private readonly signal: AbortSignal;
    private readonly strategy: IDataAccessStrategy<T>;

    private constructor(strategy: IDataAccessStrategy<T>, signal: AbortSignal) {
        this.strategy = strategy;
        this.signal = signal;
    }

    private static createStrategy<T extends {}>(dbPlugin: IDbPlugin, schema: CompiledSchema<T>) {
        return new DatabaseDataAccessStrategy<T>(dbPlugin, schema);
    }

    static create<T extends {}>(dbPlugin: IDbPlugin, schema: CompiledSchema<T>, signal: AbortSignal) {
        const strategy = DataBridge.createStrategy<T>(dbPlugin, schema);

        return new DataBridge<T>(strategy, signal);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackResult<BulkPersistResult>) {
        this.strategy.bulkPersist(event, done);
    }

    query<TShape>(event: DbPluginQueryEvent<T, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>) {
        this.strategy.query(event, done);
    }

    subscribe<TShape, U>(event: DbPluginQueryEvent<T, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>) {
        const subscription = event.operation.schema.createSubscription(this.signal);
        subscription.onMessage((changes) => {
            const filters = event.operation.options.get("filter");

            // subscription has no filter, automatically run the query
            if (filters.length === 0) {
                this.query(event, done);
                return;
            }

            // Has changes: check if any match the filter, then re-query if so
            const hasChanges = changes.adds.length > 0 || changes.updates.length > 0 || changes.removals.length > 0 || changes.unknown.length > 0;
            if (hasChanges) {

                // create a new plugin where we can quickly seed the changes and then query them
                const ephemeralPlugin = new MemoryPlugin(uuidv4());

                // seed the db, we don't care about bulk operations here, we just want to query the raw data
                ephemeralPlugin.seed(event.operation.schema, [...changes.adds, ...changes.updates, ...changes.removals]);

                // query the temp db to check and see if items match the query
                ephemeralPlugin.query(event, (r) => {

                    ephemeralPlugin.destroy({
                        id: uuid(8),
                        schemas: event.schemas,
                        source: "DataBridge",
                        action: "destroy"
                    }, () => { /* noop */ });

                    if (r.ok === Result.ERROR) {
                        done(r);
                        return;
                    }

                    if (r.data.isEmpty) {
                        return;
                    }

                    // If the query returns results, we need to query the db to find all records
                    this.query(event, done);
                });
            } else {
                // No changes in message (e.g. revalidate "invalidate" or payload lost). Re-query anyway so UI refreshes.
                this.query(event, done);
            }
        });

        return () => subscription[Symbol.dispose]();
    }
}