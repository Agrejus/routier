import { DatabaseDataAccessStrategy } from "./strategies/DatabaseDataAccessStrategy";
import { IDataAccessStrategy } from "./types";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue } from "@routier/core/plugins";
import { BulkPersistResult } from "@routier/core/collections";
import { uuid, uuidv4 } from "@routier/core/utilities";
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

    async bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        return await this.strategy.bulkPersist(event);
    }

    async query<TShape>(event: DbPluginQueryEvent<T, TShape>): Promise<ITranslatedValue<TShape>> {
        return await this.strategy.query(event);
    }

    subscribe<TShape, U>(event: DbPluginQueryEvent<T, TShape>, done: (result: ITranslatedValue<TShape>) => void) {
        const subscription = event.operation.schema.createSubscription(this.signal);
        subscription.onMessage(async (changes) => {
            const filters = event.operation.options.get("filter")

            // subscription has no filter, automatically run the query
            if (filters.length === 0) {
                try {
                    const result = await this.query(event);
                    done(result);
                } catch (error) {
                    // Error handling is up to the caller
                }
                return;
            }

            // Make sure something in the subscribed query changed, 
            // if it has, we need to requery so we can send all changes
            if (changes.adds.length > 0 || changes.updates.length > 0 || changes.removals.length > 0 || changes.unknown.length > 0) {

                // create a new plugin where we can quickly seed the changes and then query them
                const ephemeralPlugin = new MemoryPlugin(uuidv4());

                // seed the db, we don't care about bulk operations here, we just want to query the raw data
                ephemeralPlugin.seed(event.operation.schema, [...changes.adds, ...changes.updates, ...changes.removals]);

                try {
                    // query the temp db to check and see if items match the query
                    const r: ITranslatedValue<TShape> = await ephemeralPlugin.query<T, TShape>(event);

                    await ephemeralPlugin.destroy({
                        id: uuid(8),
                        schemas: event.schemas,
                        source: "collection"
                    });

                    if (r == null || (Array.isArray(r.value) && r.value.length === 0)) {
                        return;
                    }

                    // If the query returns results, we need to query the db to find all records
                    const result = await this.query(event);
                    done(result);
                } catch (error) {
                    // Error handling is up to the caller
                }
            }
        });

        return () => subscription[Symbol.dispose]();
    }
}