import { CollectionOptions } from "../types";
import { DatabaseDataAccessStrategy } from "./strategies/DatabaseDataAccessStrategy";
import { IDataAccessStrategy } from "./types";
import { MemoryPlugin } from "routier-plugin-memory";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin } from "routier-core/plugins";
import { PluginEventCallbackResult, Result } from "routier-core/results";
import { BulkPersistResult } from "routier-core/collections";
import { uuid, uuidv4 } from "routier-core/utilities";
import { CompiledSchema } from "routier-core/schema";

// Use a data bridge so we can abstract away some of the stuff
// a new collection should not need to worry about
export class DataBridge<T extends {}> {

    private readonly signal: AbortSignal;
    private readonly strategy: IDataAccessStrategy<T>;
    private readonly options: CollectionOptions;

    private constructor(strategy: IDataAccessStrategy<T>, options: CollectionOptions) {
        this.strategy = strategy;
        this.signal = options.signal;
        this.options = options;
    }

    private static createStrategy<T extends {}>(dbPlugin: IDbPlugin, schema: CompiledSchema<T>, options: CollectionOptions) {
        return new DatabaseDataAccessStrategy<T>(dbPlugin, schema);
    }

    static create<T extends {}>(dbPlugin: IDbPlugin, schema: CompiledSchema<T>, options: CollectionOptions) {
        const strategy = DataBridge.createStrategy<T>(dbPlugin, schema, options);

        return new DataBridge<T>(strategy, options);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackResult<BulkPersistResult>) {
        this.strategy.bulkPersist(this.options, event, done);
    }

    query<TShape>(event: DbPluginQueryEvent<T, TShape>, done: PluginEventCallbackResult<TShape>) {
        this.strategy.query(this.options, event, done);
    }

    subscribe<TShape, U>(event: DbPluginQueryEvent<T, TShape>, done: PluginEventCallbackResult<TShape>) {
        const subscription = event.operation.schema.createSubscription(this.signal);
        subscription.onMessage((changes) => {

            const filters = event.operation.options.get("filter")

            // subscription has no filter, automatically run the query
            if (filters.length === 0) {
                this.query(event, done);
                return;
            }

            // Make sure something in the subscribed query changed, 
            // if it has, we need to requery so we can send all changes
            if (changes.adds.length > 0 || changes.updates.length > 0 || changes.removals.length > 0 || changes.unknown.length > 0) {

                // create a new plugin where we can quickly seed the changes and then query them
                const ephemeralPlugin = new MemoryPlugin(uuidv4());

                // seed the db, we don't care about bulk operations here, we just want to query the raw data
                ephemeralPlugin.seed(event.operation.schema, [...changes.adds, ...changes.updates, ...changes.removals]);

                // query the temp db to check and see if items match the query
                ephemeralPlugin.query(event, (r) => {

                    ephemeralPlugin.destroy({
                        id: uuid(8),
                        schemas: event.schemas
                    }, () => { /* noop */ });

                    if (r.ok === Result.ERROR) {
                        done(r);
                        return;
                    }

                    if (r == null || (Array.isArray(r) && r.length === 0)) {
                        return;
                    }

                    // If the query returns results, we need to query the db to find all records
                    this.query(event, done);
                });
            }
        });

        return () => subscription[Symbol.dispose]();
    }
}