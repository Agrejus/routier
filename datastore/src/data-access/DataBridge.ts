import { DatabaseDataAccessStrategy } from "./strategies/DatabaseDataAccessStrategy";
import { IDataAccessStrategy } from "./types";
import { ChangeMatchProbe } from "./ChangeMatchProbe";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, Query } from "@routier/core/plugins";
import { PluginEventCallbackResult, PluginEventResultType, Result } from "@routier/core/results";
import { BulkPersistResult } from "@routier/core/collections";
import { uuid, uuidv4 } from "@routier/core/utilities";
import { CompiledSchema, InferType } from "@routier/core/schema";

// Use a data bridge so we can abstract away some of the stuff
// a new collection should not need to worry about
export class DataBridge<T extends {}> {

    private readonly signal: AbortSignal;
    private readonly strategy: IDataAccessStrategy<T>;
    private readonly scope?: string;

    private constructor(strategy: IDataAccessStrategy<T>, signal: AbortSignal, scope?: string) {
        this.strategy = strategy;
        this.signal = signal;
        this.scope = scope;
    }

    private static createStrategy<T extends {}>(dbPlugin: IDbPlugin, schema: CompiledSchema<T>) {
        return new DatabaseDataAccessStrategy<T>(dbPlugin, schema);
    }

    static create<T extends {}>(dbPlugin: IDbPlugin, schema: CompiledSchema<T>, signal: AbortSignal) {
        const strategy = DataBridge.createStrategy<T>(dbPlugin, schema);

        return new DataBridge<T>(strategy, signal, dbPlugin.databaseName);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackResult<BulkPersistResult>) {
        this.strategy.bulkPersist(event, done);
    }

    query<TShape>(event: DbPluginQueryEvent<T, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>) {
        this.strategy.query(event, done);
    }

    /**
     * The query as one dispatch sends it: its own copy of the options, and its own statements list.
     *
     * A plugin reports on the options it receives, and a report is only an answer for that dispatch.
     * Sent as-is, the subscription's event would carry the last dispatch's reports, or the change
     * probe's, into the next one.
     */
    private static forDispatch<T extends {}, TShape>(event: DbPluginQueryEvent<T, TShape>): DbPluginQueryEvent<T, TShape> {
        return {
            ...event,
            operation: new Query<T, TShape>(event.operation.options.forDispatch(), event.operation.schema, event.operation.changeTracking),
            executedQueries: []
        };
    }

    /**
     * Re-runs a query whenever its schema's rows change.
     *
     * `event` is the query as planned and is never sent itself. Each dispatch, the change probe's
     * included, sends its own copy, and `done` receives the copy the plugin answered, since that is
     * where its reports are.
     */
    subscribe<TShape, _U>(
        event: DbPluginQueryEvent<T, TShape>,
        done: (result: PluginEventResultType<ITranslatedValue<TShape>>, dispatched: DbPluginQueryEvent<T, TShape>) => void,
        lastDeliveredIds?: () => ReadonlySet<unknown> | null
    ) {
        const dispatch = () => {
            const dispatched = DataBridge.forDispatch(event);

            this.query(dispatched, result => done(result, dispatched));
        };

        const subscription = event.operation.schema.createSubscription(this.signal, this.scope);
        subscription.onMessage((changes) => {
            const filters = event.operation.options.get("filter");

            // subscription has no filter, automatically run the query
            if (filters.length === 0) {
                dispatch();
                return;
            }

            // Leave-detection (defect #24): the filter check below sees only a changed
            // row's NEW value, so an update that makes a row STOP matching never fired and
            // the subscriber kept rendering a row that had left its result set. Any changed
            // row whose id was in the LAST DELIVERED result either changed or left — both
            // require a re-query. Entering rows are still caught by the filter check.
            const membership = lastDeliveredIds?.();
            if (membership != null && membership.size > 0) {
                const schema = event.operation.schema;
                const changed = [...changes.adds, ...changes.updates, ...changes.removals, ...changes.unknown];

                if (changed.some(entity => membership.has(schema.getId(entity as InferType<T>)))) {
                    dispatch();
                    return;
                }
            }

            // Has changes: check if any match the filter, then re-query if so
            const hasChanges = changes.adds.length > 0 || changes.updates.length > 0 || changes.removals.length > 0 || changes.unknown.length > 0;
            if (hasChanges) {

                // A scratch store, private to this question. Built from core's own pieces
                // rather than a backend plugin — see ChangeMatchProbe.
                const ephemeralPlugin = new ChangeMatchProbe(uuidv4());

                // seed the db, we don't care about bulk operations here, we just want to query the raw data
                ephemeralPlugin.seed(event.operation.schema, [...changes.adds, ...changes.updates, ...changes.removals]);

                // query the temp db to check and see if items match the query, on a copy of its own so
                // nothing it reports can reach the real plugin's dispatch
                const probeEvent = DataBridge.forDispatch(event);

                ephemeralPlugin.query(probeEvent, (r) => {

                    ephemeralPlugin.destroy({
                        id: uuid(8),
                        schemas: event.schemas,
                        source: "DataBridge",
                        action: "destroy"
                    }, () => { /* noop */ });

                    if (r.ok === Result.ERROR) {
                        done(r, probeEvent);
                        return;
                    }

                    if (r.data.isEmpty) {
                        return;
                    }

                    // If the query returns results, we need to query the db to find all records
                    dispatch();
                });
            } else {
                // No changes in message (e.g. revalidate "invalidate" or payload lost). Re-query anyway so UI refreshes.
                dispatch();
            }
        });

        return () => subscription[Symbol.dispose]();
    }
}