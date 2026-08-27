import {
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    DbPluginQueryEvent,
    IDbPlugin,
    ITranslatedValue,
    joinInPlugin,
    QueryOrdering,
} from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "@routier/core/results";
import { BulkPersistResult, SchemaPersistChanges } from "@routier/core/collections";
import { CompiledSchema } from "@routier/core/schema";
import { OptimisticConcurrencyError } from "@routier/core";
import { UnknownRecord, uuidv4 } from "@routier/core/utilities";
import { MongoCollection, MongoDriver, MongoFindOptions, MongoUpdate } from "./driver";
import { MqlFilter, canRenderInMql, toMql } from "./mql";
import { MongoTranslator } from "./MongoTranslator";
import { assertMongoSchema } from "./schemaRules";

/**
 * Routier over MongoDB.
 *
 * Documents are stored as the entity is: Mongo has native nested objects, arrays and dates,
 * so unlike the SQL plugins there is no JSON column to encode into and no decode on the way
 * back. That is the whole of the storage story.
 *
 * ## What is pushed down, and what is not
 *
 * Filters, sort, skip and take reach the server. Everything else — map, group, distinct and
 * the aggregates — is evaluated by `JsonTranslator`, which is correct on every backend by
 * construction. Pushing an aggregate into an aggregation pipeline is a later optimisation
 * with a different risk profile, and doing it badly returns wrong numbers rather than slow
 * ones.
 *
 * ## Saves are atomic, and what that depends on
 *
 * `bulkPersist` runs inside `driver.transaction`, so a save spanning two collections either
 * applies to both or to neither — the datastore's contract, and what the SQL plugins get from
 * BEGIN/COMMIT.
 *
 * It depends on the driver. MongoDB transactions need a replica set, and a standalone
 * `mongod` rejects them outright, so `MongoClientDriver` takes an explicit
 * `transactions: "required" | "unavailable"` rather than detecting it. A store that lost
 * atomicity by moving to a standalone would be the worst possible thing to discover quietly.
 *
 * The driver runs the save exactly once and retries nothing, so there is no transaction
 * mechanics to reason about here — a conflict fails the save and reaches the caller, the way
 * it does on every other backend.
 */
export class MongoDbPlugin implements IDbPlugin {

    private readonly driver: MongoDriver;

    /** See `IDbPlugin.databaseName`. Defaults to the driver's database name. */
    readonly databaseName: string;

    constructor(driver: MongoDriver, databaseName?: string) {
        this.driver = driver;
        this.databaseName = databaseName ?? driver.name;
    }

    // ---------------------------------------------------------------------------- query

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        // Two ordinary queries through this same path — outer first, so its keys narrow the inner
        // read — and the shared hash join over the results. `$lookup` is deliberately not used:
        // pairing here is already correct, and the pipeline surface is not worth adding until a
        // measurement says it is.
        if (event.operation.options.has("join")) {
            joinInPlugin(event, (innerEvent, innerDone) => this.query(innerEvent, innerDone), done);
            return;
        }

        this._query(event, done);
    }

    private _query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const { schema, options } = event.operation;

        try {
            assertMongoSchema(schema);
        } catch (error) {
            done(PluginEventResult.error(event.id, error));
            return;
        }

        const translator = new MongoTranslator<TRoot, TShape>(event.operation);

        let filter: MqlFilter = {};
        const find: { sort?: Record<string, 1 | -1>; skip?: number; limit?: number } = {};

        const sortKeys: Record<string, 1 | -1> = {};

        /**
         * Ask before translating.
         *
         * MQL has no operator for JavaScript's shifts, and `toMql` throws rather than invent one. That
         * throw would surface as a failed query for a filter that used to parse as unreadable and run
         * in memory — correct but slow turning into an error. Reported instead, and the datastore
         * finishes the query over the documents this one returns.
         */
        for (const item of options.get("filter")) {
            const expression = (item.option.value as { expression?: Parameters<typeof canRenderInMql>[0] }).expression;

            if (expression != null && canRenderInMql(expression) === false) {
                options.reportMissingCapability(item);
            }
        }

        try {
            options.forEach(option => {
                if (option.target !== "database" || option.reason !== "executed") {
                    return;
                }

                if (option.name === "filter") {
                    const value = option.value as { expression: Parameters<typeof toMql>[0] };
                    filter = mergeFilters(filter, toMql(value.expression));
                    return;
                }

                if (option.name === "sort") {
                    const value = option.value as { propertyName: string; direction: QueryOrdering };
                    sortKeys[value.propertyName] = value.direction === QueryOrdering.Descending ? -1 : 1;
                    return;
                }

                if (option.name === "skip") {
                    find.skip = option.value as number;
                    return;
                }

                if (option.name === "take") {
                    find.limit = option.value as number;
                }
            });
        } catch (error) {
            // A filter with no MQL form. `toMql` names the remedy; surfacing it beats
            // widening the filter or scanning the collection.
            done(PluginEventResult.error(event.id, error));
            return;
        }

        // Every filter that reaches this plugin ran on the server: Routier routes memory-target
        // options (and everything after them) away from plugins, and a filter with no MQL form throws above.
        translator.pushedDown.filter = true;

        if (Object.keys(sortKeys).length > 0) {
            find.sort = sortKeys;
            translator.pushedDown.sort = true;
        }

        // Windowing is only safe once the server sees the same rows, in the same order, that
        // the caller's query describes.
        const canWindow = find.sort != null || options.get("sort").length === 0;

        if (canWindow === false) {
            delete find.skip;
            delete find.limit;
        } else {
            translator.pushedDown.skip = find.skip != null;
            translator.pushedDown.take = find.limit != null;
        }

        this.driver
            .collection(schema.collectionName)
            .then(collection => collection.find(filter, find as MongoFindOptions))
            .then(documents => {
                // Mongo has no statement text; the filter and options ARE the query, so they are
                // what gets reported. After the read, not before — RetryDbPlugin re-invokes with
                // the same event.
                event.executedQueries.push({
                    text: `db.${schema.collectionName}.find(${JSON.stringify(filter)}, ${JSON.stringify(find)})`
                });

                done(PluginEventResult.success(event.id, translator.translate(documents)));
            })
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    // ---------------------------------------------------------------------- bulkPersist

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.driver.transaction(async scope => {
            const result = event.operation.toResult();

            for (const [schemaId, schema] of event.schemas) {
                const changes = event.operation.get(schemaId);

                if (!changes || changes.hasItems === false) {
                    continue;
                }

                assertMongoSchema(schema as CompiledSchema<UnknownRecord>);

                // From the SCOPE, never from the driver: a collection taken from the driver
                // would run outside the transaction and look identical here.
                const collection = await scope.collection(schema.collectionName);

                // Removes, then updates, then adds — the order the SQL plugins and Dexie use,
                // so a remove-then-add of one key behaves the same on every backend.
                await this.applyRemoves(collection, schema as CompiledSchema<any>, changes as SchemaPersistChanges<any>, result.get(schemaId) as any);
                await this.applyUpdates(collection, schema as CompiledSchema<any>, changes as SchemaPersistChanges<any>, result.get(schemaId) as any);
                await this.applyAdds(collection, schema as CompiledSchema<any>, changes as SchemaPersistChanges<any>, result.get(schemaId) as any);
            }

            return result;
        })
            .then(persisted => done(PluginEventResult.success(event.id, persisted)))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    private async applyRemoves(
        collection: MongoCollection,
        schema: CompiledSchema<any>,
        changes: SchemaPersistChanges<any>,
        into: { removes: unknown[] }
    ): Promise<void> {
        if (changes.removes.length === 0) {
            return;
        }

        const ids = changes.removes.map(entity => schema.getIds(entity)[0]);

        await collection.deleteMany({ _id: { $in: ids } });

        into.removes.push(...changes.removes);
    }

    /**
     * Updates, with the concurrency token folded into the selector.
     *
     * This is the one place MongoDB is straightforwardly better than the batch-only engines:
     * a conditional update is just a filter, so `updateOne({ _id, token: expected })` matching
     * zero documents IS the conflict. No probe table and no separate read.
     */
    private async applyUpdates(
        collection: MongoCollection,
        schema: CompiledSchema<any>,
        changes: SchemaPersistChanges<any>,
        into: { updates: unknown[] }
    ): Promise<void> {
        if (changes.updates.length === 0) {
            return;
        }

        const updates: MongoUpdate[] = changes.updates.map(update => {
            const filter: MqlFilter = { _id: schema.getIds(update.entity)[0] };

            if (update.concurrency != null) {
                filter[update.concurrency.column] = update.concurrency.expected;
            }

            return { filter, set: flattenDelta(update.delta as Record<string, unknown>) };
        });

        const matched = await collection.updateMany(updates);

        const conflicted = changes.updates
            .filter((update, index) => update.concurrency != null && matched[index] === 0)
            .map(update => schema.getIds(update.entity)[0]);

        if (conflicted.length > 0) {
            throw new OptimisticConcurrencyError(schema.collectionName, conflicted as never[]);
        }

        into.updates.push(...changes.updates.map(update => update.entity));
    }

    private async applyAdds(
        collection: MongoCollection,
        schema: CompiledSchema<any>,
        changes: SchemaPersistChanges<any>,
        into: { adds: unknown[] }
    ): Promise<void> {
        if (changes.adds.length === 0) {
            return;
        }

        const [idProperty] = schema.idProperties;

        for (const add of changes.adds) {
            // Assigned here rather than left to the server: the change tracker matches the
            // echoed document back to the entity it saved, and it can only do that if the id
            // it already holds is the one that was stored.
            const document = add as UnknownRecord;

            if (idProperty.getValue(document) == null) {
                idProperty.setValue(document, uuidv4());
            }
        }

        await collection.insertMany(changes.adds as Record<string, unknown>[]);

        into.adds.push(...changes.adds);
    }

    // -------------------------------------------------------------------------- destroy

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.driver
            .dropDatabase()
            .then(() => this.driver.close())
            .then(() => done(PluginEventResult.success(event.id)))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }
}

/**
 * Two filters, both of which must hold.
 *
 * A query may carry several `where` calls, and they are conjunctive. Merging by key would
 * lose one of two conditions on the same property (`price > 5` and `price < 10` both write
 * `price`), so they are combined with `$and` unless one side is empty.
 */
function mergeFilters(left: MqlFilter, right: MqlFilter): MqlFilter {
    if (Object.keys(left).length === 0) {
        return right;
    }

    if (Object.keys(right).length === 0) {
        return left;
    }

    return { $and: [left, right] };
}

/**
 * An `EntityDelta` as a `$set` payload.
 *
 * A delta is a PARTIAL entity — `{ payload: { inner: { value: 'x' } } }` — and handing that
 * to `$set` as-is replaces the whole `payload` subtree, silently dropping the siblings that
 * did not change. That is the same defect `toColumnAssignments` documents on the SQL side,
 * where it is solved by writing the merged subtree from the entity.
 *
 * Mongo can express it exactly instead: `$set` takes dotted paths, so
 * `{ 'payload.inner.value': 'x' }` writes one leaf and leaves its siblings alone.
 */
function flattenDelta(delta: Record<string, unknown>, prefix = ""): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(delta)) {
        const path = prefix === "" ? key : `${prefix}.${key}`;

        // Arrays and dates are values, not structures to descend into — the same rule
        // `EntityDelta` states. An element-wise array delta cannot express a removal.
        const isStructure =
            value != null &&
            typeof value === "object" &&
            Array.isArray(value) === false &&
            value instanceof Date === false;

        if (isStructure) {
            Object.assign(flattened, flattenDelta(value as Record<string, unknown>, path));
            continue;
        }

        flattened[path] = value;
    }

    return flattened;
}
