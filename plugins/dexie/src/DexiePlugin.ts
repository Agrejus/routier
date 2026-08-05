import Dexie from 'dexie';
import { convertToDexieSchema } from "./utils";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { InferCreateType, PropertyInfo, SchemaTypes } from '@routier/core/schema';
import { uuidv4 } from '@routier/core/utilities';
import { ParamsFilter } from '@routier/core/expressions';
import { DexieTranslator } from './DexieTranslator';

/**
 * Derived stores specs, keyed by `dbName` and validated by a FINGERPRINT of the schema set.
 *
 * The previous check was `Object.keys(cached).length === event.schemas.size` — an entry
 * count. Two different schema sets of the same size returned the first one's stores, and
 * because the rebuild path also skipped any collection name already present, a *changed*
 * definition for an existing name was never refreshed either. Both produce a database whose
 * indexes do not match its schema, silently.
 */
const cache = new Map<string, { fingerprint: string; stores: Record<string, string> }>();

/** Order-independent identity of a schema set: names plus their full stores specs. */
const fingerprintOf = (stores: Record<string, string>): string =>
    Object.keys(stores).sort().map(name => `${name}=${stores[name]}`).join('|');

export type DexiePluginOptions = {
    /**
     * IndexedDB schema version, default `1`.
     *
     * Dexie keys a database's index layout to a version number, and redefining one version
     * with a different layout is an error rather than a migration. So a schema change — a
     * new collection, a new index, a renamed key — needs this bumped. When the computed
     * layout differs from what the stored version holds and this has not been raised, the
     * plugin says so; see the README's schema-versioning section.
     */
    version?: number;
};

export class DexiePlugin implements IDbPlugin, Disposable {

    private readonly dbName: string;
    private readonly version: number;

    constructor(dbName: string, options?: DexiePluginOptions) {
        this.dbName = dbName;
        this.version = options?.version ?? 1;
    }

    /**
     * Turns Dexie's version error into one that names the cause and the fix.
     *
     * Dexie reports a layout that disagrees with the stored version as `VersionError` or
     * `SchemaError`, neither of which mentions the plugin option the caller has to change.
     */
    private describeVersionFailure(error: unknown): unknown {
        const name = (error as { name?: string } | null)?.name;

        if (name !== 'VersionError' && name !== 'SchemaError' && name !== 'UpgradeError') {
            return error;
        }

        return new Error(
            `Dexie rejected the schema for database '${this.dbName}' at version ${this.version}: ` +
            `${(error as Error).message}. The stored database holds a different index layout for ` +
            `this version. IndexedDB does not re-derive a layout in place — pass a higher ` +
            `\`version\` to the DexiePlugin constructor so Dexie runs an upgrade, or delete the ` +
            `database if its contents are disposable.`,
            { cause: error }
        );
    }

    private _doWork<TResult>(event: DbPluginEvent, work: (db: Dexie, done: PluginEventCallbackResult<TResult>) => void, done: PluginEventCallbackResult<TResult>, shouldClose: boolean = true) {
        let db: Dexie | undefined;

        try {
            // Inside the try, all three. `new Dexie`, `getSchemas` and `.stores()` can each
            // throw — a bad stores spec, an unparseable schema, a version conflict — and
            // outside it those escaped `_doWork` synchronously instead of reaching `done`,
            // so the caller saw a raw exception rather than a failed event.
            db = new Dexie(this.dbName);

            const stores = this.getSchemas(event);

            db.version(this.version).stores(stores);

            work(db, (result) => {

                if (shouldClose) {
                    db!.close();
                }

                done(result);
            });
        } catch (e) {
            // Close on the error path too: the handle was opened here, and leaving it to the
            // garbage collector holds an IndexedDB connection that blocks a later
            // version upgrade of the same database.
            db?.close();
            done(PluginEventResult.error(event.id, this.describeVersionFailure(e)));
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        const db = new Dexie(this.dbName);
        db.delete().then(() => done(PluginEventResult.success(event.id))).catch(_ => done(PluginEventResult.error(event.id, event)));
    }

    private trySetId<TRoot extends {}>(instance: InferCreateType<TRoot>, stringProperty: PropertyInfo<TRoot>) {
        const value = stringProperty.getValue(instance);

        // If we are using optimistic inserts, the id will already be set, ignore it
        if (value == null) {
            stringProperty.setValue(instance, uuidv4());
        }
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {

        this._doWork(event, async (db, d) => {
            const operationResult = event.operation.toResult();

            try {
                // Every collection this event touches, resolved up front: Dexie needs the
                // full table list when the transaction opens and cannot be given more later.
                const touched: { schemaId: typeof event.schemas extends Map<infer K, any> ? K : never; schema: any; changes: any }[] = [];

                for (const [schemaId, schema] of event.schemas) {
                    const changes = event.operation.get(schemaId);

                    if (!changes || changes.hasItems === false) {
                        continue;
                    }

                    touched.push({ schemaId, schema, changes } as never);
                }

                if (touched.length === 0) {
                    d(PluginEventResult.success(event.id, operationResult));
                    return;
                }

                const tables = touched.map(({ schema }) => db.table(schema.collectionName));

                /**
                 * ONE transaction for the whole event.
                 *
                 * This was a `jobs: Promise[]` array awaited with `Promise.all`, so each
                 * collection's writes were an independent IndexedDB transaction running
                 * concurrently. A save spanning two collections could therefore commit the
                 * first and fail the second, leaving the store's collections disagreeing
                 * with each other while `saveChanges` reported failure — and the datastore's
                 * own contract is that a save is all-or-nothing.
                 *
                 * Ordered removes → updates → adds within the transaction, matching the SQL
                 * plugins, so a remove-then-add of the same key behaves the same everywhere.
                 */
                await db.transaction('rw', tables, async () => {
                    for (const { schemaId, schema, changes } of touched) {
                        const collection = db.table(schema.collectionName);
                        const schemaSpecificResult = operationResult.get(schemaId as never);

                        if (changes.removes.length > 0) {
                            const ids = changes.removes.map((x: any) => {

                                if (schema.idProperties.length === 1) {
                                    // Handle single key, return the value
                                    return schema.getIds(x)[0];
                                }

                                // Handle composite keys, should return a tuple
                                return schema.getIds(x);
                            });

                            await collection.bulkDelete(ids);
                            schemaSpecificResult.removes.push(...changes.removes);
                        }
                    }

                    for (const { schemaId, schema, changes } of touched) {
                        const collection = db.table(schema.collectionName);
                        const schemaSpecificResult = operationResult.get(schemaId as never);

                        if (changes.updates.length > 0) {
                            const updatedDocuments = changes.updates.map((x: any) => x.entity);

                            await collection.bulkPut(updatedDocuments);
                            schemaSpecificResult.updates.push(...updatedDocuments);
                        }
                    }

                    for (const { schemaId, schema, changes } of touched) {
                        const collection = db.table(schema.collectionName);
                        const schemaSpecificResult = operationResult.get(schemaId as never);

                        if (changes.adds.length === 0) {
                            continue;
                        }

                        if (schema.hasIdentities !== true) {
                            await collection.bulkAdd(changes.adds);
                            schemaSpecificResult.adds.push(...changes.adds);
                            continue;
                        }

                        // generate UUID's, Dexie does not generate them
                        const stringIds = schema.idProperties.filter((x: any) => x.type === SchemaTypes.String);
                        const hasAllStringIds = schema.idProperties.length === stringIds.length;

                        for (let i = 0, length = changes.adds.length; i < length; i++) {
                            const add = changes.adds[i];

                            if (stringIds.length === 1) {
                                this.trySetId(add, stringIds[0]);
                            } else {
                                for (let j = 0, inner = stringIds.length; j < inner; j++) {
                                    this.trySetId(add, stringIds[j]);
                                }
                            }
                        }

                        if (hasAllStringIds === true) {
                            await collection.bulkAdd(changes.adds);
                            schemaSpecificResult.adds.push(...changes.adds);
                            continue;
                        }

                        // A non-string key is assigned by Dexie, so each row goes in on its
                        // own to read its generated id back. This used to open its own nested
                        // transaction; it now runs inside the event's, which is what makes the
                        // generated ids roll back with everything else.
                        for (const add of changes.adds) {
                            const id = await collection.add(add);

                            schema.idProperties[0].setValue(add, id);
                            schemaSpecificResult.adds.push(add);
                        }
                    }
                });

                d(PluginEventResult.success(event.id, operationResult));
            } catch (e) {
                d(PluginEventResult.error(event.id, e));
            }
        }, done);
    }

    private getSchemas(event: DbPluginEvent): Record<string, string> {

        // Always derived, never skipped for an already-present name. Deriving a stores spec
        // is string work over a compiled schema; the cache exists to avoid repeating it, not
        // to decide what the schema IS.
        const derived: Record<string, string> = {};

        for (const [, schema] of event.schemas) {
            derived[schema.collectionName] = convertToDexieSchema(schema);
        }

        const fingerprint = fingerprintOf(derived);
        const cached = cache.get(this.dbName);

        if (cached != null && cached.fingerprint === fingerprint) {
            return cached.stores;
        }

        // One database may be shared by two datastores with different schemas (HttpSwrPlugin
        // does this), so the union is what Dexie has to be given — a stores spec naming only
        // this event's collections would drop the other datastore's tables. Merged over the
        // cached entry, with this event's freshly derived specs winning.
        const merged = { ...cached?.stores, ...derived };

        cache.set(this.dbName, { fingerprint: fingerprintOf(merged), stores: merged });

        return merged;
    }

    private getSelectedProperties<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>) {

        const { options } = event.operation;

        const map = options.getLast("map");

        if (map != null) {

            return map.value.fields.map(x => x.property!);
        }

        return event.operation.schema.properties;
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this._doWork(event, (db, d) => {

            const { collectionName } = event.operation.schema;
            const { options } = event.operation;
            const translator = new DexieTranslator<TEntity, TShape>(event.operation);

            // Start with the base collection
            let collection = db.table(collectionName).toCollection();

            // A window may only be pushed down to Dexie when nothing else reorders or
            // reduces the rows first:
            //
            // - Dexie applies `offset`/`limit` while walking the index cursor, before the
            //   JS callbacks added by `filter`. `where(...).skip(2)` therefore skips two
            //   rows of the whole table and filters what remains, rather than skipping two
            //   of the matches.
            // - Sorting is not pushed down at all (there is no `sort` branch below); the
            //   translator sorts in memory after this query returns. Offsetting here would
            //   window the unsorted rows and sort only the survivors.
            //
            // In either case the window has to be applied in memory, after filtering and
            // sorting, so the translator is told to take it over.
            const hasFilter = options.get("filter").length > 0;
            const hasSort = options.get("sort").length > 0;
            const canPushDownWindow = hasFilter === false && hasSort === false;

            if (canPushDownWindow === false) {
                translator.options.useTranslatorSkip = true;
                translator.options.useTranslatorTake = true;
            }

            options.forEach(option => {

                if (option.name === "filter") {
                    if (option.value.params == null) {
                        // standard filtering
                        collection = collection.filter(option.value.filter);
                    } else {
                        // params filtering
                        const selector = option.value.filter as ParamsFilter<unknown, {}>
                        collection = collection.filter(item => selector([item, option.value.params]));
                    }
                    return;
                }

                if (option.name === "skip") {
                    if (canPushDownWindow) {
                        collection = collection.offset(option.value);
                    }
                    return
                }

                if (option.name === "take") {
                    if (canPushDownWindow) {
                        collection = collection.limit(option.value);
                    }
                    return
                }

                if (option.name === "distinct") {

                    const selectedProperties = this.getSelectedProperties(event);

                    // distinct only works on properties that have an index,
                    // convert database operation to memory operation
                    if (selectedProperties.some(x => x.indexes.length === 0)) {
                        translator.options.useTranslatorDistinct = true;
                    } else {
                        collection = collection.distinct();
                    }
                    return
                }
            });

            // Get the data first
            collection.toArray().then(data => {
                const result = translator.translate(data);

                d(PluginEventResult.success(event.id, result));
            }).catch(e => d(PluginEventResult.error(event.id, e)));
        }, done);
    }

    [Symbol.dispose](): void {

    }
}