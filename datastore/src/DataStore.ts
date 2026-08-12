import { Collection } from './collections/Collection';
import { AuditRegistry } from './collection-builder/audit';
import { FullTextSearchRegistry } from './collection-builder/fullTextSearch';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines, DataStoreOptions, ResolvedDataStoreOptions, resolveDataStoreOptions } from './types';
import { IDbPlugin, QueryOptionsCollection } from '@routier/core/plugins';
import { CompiledSchema, SchemaId } from '@routier/core/schema';
import { TrampolinePipeline } from '@routier/core/pipeline';
import type { DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { applyFromPersistResult, applyToChanges, hasTransforms, schemaCollectionView } from './transforms';
import { CallbackPartialResult, CallbackResult, PartialResultType, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection, ReadonlySchemaCollection } from '@routier/core/collections';
import { UnknownRecord, uuid } from '@routier/core/utilities';
import { View } from './views/View';
import { ViewBuilder } from './view-builder/ViewBuilder';
import { CollectionBase } from './collections/CollectionBase';
import { CollectionDependencies } from './collections/types';
import { ChangeTracker } from './change-tracking/ChangeTracker';
import { DataBridge } from './data-access/DataBridge';
import { assertIsNotNull } from '@routier/core';

/**
 * Removes the datastore-internal `previous` values from every update in a save.
 *
 * See `EntityUpdateInfo.previous`. Deleting the property rather than setting it to undefined,
 * so a plugin that serializes the update — the HTTP family does — emits nothing at all for it.
 */
function stripPreviousValues(changes: BulkPersistChanges) {
    for (const [, schemaChanges] of changes) {
        for (const update of schemaChanges.updates) {

            if (update.previous != null) {
                delete update.previous;
            }
        }
    }
}

/**
 * The main Routier class, providing collection management, change tracking, and persistence for entities.
 *
 * @implements Disposable
 */
export class DataStore implements Disposable {

    /** The underlying database plugin used for persistence. */
    protected readonly dbPlugin: IDbPlugin;
    /** Map of schema key to collection instances. */
    protected readonly collections: Map<SchemaId, CollectionBase<any>>;
    /** Pipelines for save and hasChanges operations. */
    protected readonly collectionPipelines: CollectionPipelines;
    /** AbortController for managing cancellation and disposal. */
    protected readonly abortController: AbortController;

    protected readonly _schemas: SchemaCollection;
    /** Audit declarations, shared by every collection — auditing runs once per save. */
    protected readonly _audits = new AuditRegistry();
    /** Full-text search declarations, shared for the same reason as `_audits`. */
    protected readonly _fullTextSearches = new FullTextSearchRegistry();
    /** Store-wide settings with defaults resolved. See `DataStoreOptions`. */
    protected readonly storeOptions: ResolvedDataStoreOptions;

    get schemas() {
        return new ReadonlySchemaCollection([...this._schemas]);
    }

    /**
     * Constructs a new Routier instance.
     * @param dbPlugin The database plugin to use for persistence.
     * @param options Store-wide settings. Every one has a default; see `DataStoreOptions`.
     */
    constructor(dbPlugin: IDbPlugin, options?: DataStoreOptions) {
        this.abortController = new AbortController();
        this.dbPlugin = dbPlugin;
        this.storeOptions = resolveDataStoreOptions(options);
        this.collections = new Map<SchemaId, CollectionBase<any>>();
        this._schemas = new SchemaCollection();
        this.collectionPipelines = {
            prepareChanges: new TrampolinePipeline<PartialResultType<BulkPersistChanges>>(),
            afterPersist: new TrampolinePipeline<PartialResultType<{ changes: BulkPersistChanges, result: BulkPersistResult }>>(),
        };
    }

    getDbPlugin<T extends IDbPlugin>() {
        return this.dbPlugin as T;
    }

    getCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): Collection<TEntity> {
        const collection = this.collections.get(schema.id);

        assertIsNotNull(collection, `DataStore.getCollection() -> Could not find collection for schema Id.  Id: ${schema.id}, CollectionName: ${schema.collectionName}`);

        return collection as Collection<TEntity>;
    }

    /**
     * Creates a new collection builder for the given schema.
     *
     * The return type carries `this` — the CONCRETE store type, because `this` in a subclass's
     * field initializer is that subclass. That is what lets a collection name its siblings:
     * `store.players.join(s => s.playerMatches, ...)` type-checks `s` against the store the
     * collection was declared in, so a wrong name is a compile error rather than a query that
     * quietly returns nothing.
     *
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected collection<TEntity extends {}>(schema: CompiledSchema<TEntity>): CollectionBuilder<TEntity, this> {
        const onCreated = (collection: CollectionBase<TEntity, any>) => {

            if (this.collections.has(schema.id)) {
                throw new Error(`Cannot have two collections/views with the same schema.  Schema Collection Name: ${schema.collectionName}`);
            }

            this.collections.set(schema.id, collection as Collection<TEntity>);
            this._schemas.set(schema.id, schema as CompiledSchema<UnknownRecord>);
        };

        const dependencies = new CollectionDependencies<TEntity>(
            this.dbPlugin,
            schema,
            this._schemas,
            this.collectionPipelines,
            this.abortController.signal,
            new QueryOptionsCollection<TEntity>(),
            schema.createSubscription(this.abortController.signal, this.dbPlugin.databaseName),
            new ChangeTracker<TEntity>(schema),
            DataBridge.create<TEntity>(this.dbPlugin, schema, this.abortController.signal),
            this._audits,
            this,
            this.storeOptions,
            this._fullTextSearches
        );

        // No mode is chosen here on purpose: the returned builder has no create() until
        // the caller declares HOW mutations are tracked — proxy(), diff(), immutable(),
        // or readonly().
        return new CollectionBuilder<TEntity, this>({
            dependencies,
            onCollectionCreated: onCreated.bind(this),
        });
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected view<TEntity extends {}>(schema: CompiledSchema<TEntity>): ViewBuilder<TEntity, View<TEntity, this>, this> {

        if (schema.idProperties.some(x => x.isIdentity)) {
            throw new Error("View cannot have an identty key.  Must be a known/computed key so Routier can find and update the record");
        }

        // Register schema immediately so it's available when derive() runs queries
        // This prevents timing issues where queries from derive() run before the schema is registered
        if (!this._schemas.has(schema.id)) {
            this._schemas.set(schema.id, schema as CompiledSchema<UnknownRecord>);
        }

        const onCreated = (view: View<TEntity, this>) => {

            if (this.collections.has(schema.id)) {
                throw new Error(`Cannot have two collections/views with the same schema.  Schema Collection Name: ${schema.collectionName}`);
            }

            this.collections.set(schema.id, view);
            // Schema is already registered above, but ensure it's set in case of race conditions
            this._schemas.set(schema.id, schema as CompiledSchema<UnknownRecord>);
        };

        const dependencies = new CollectionDependencies<TEntity>(
            this.dbPlugin,
            schema,
            this._schemas,
            this.collectionPipelines,
            this.abortController.signal,
            new QueryOptionsCollection<TEntity>(),
            schema.createSubscription(this.abortController.signal, this.dbPlugin.databaseName),
            new ChangeTracker<TEntity>(schema),
            DataBridge.create<TEntity>(this.dbPlugin, schema, this.abortController.signal),
            this._audits,
            this,
            this.storeOptions,
            this._fullTextSearches
        );

        return new ViewBuilder<TEntity, View<TEntity, this>, this>({
            dependencies,
            instanceCreator: View<TEntity, this>,
            onCollectionCreated: onCreated.bind(this),
        });
    }

    /** Whether any schema declares a transform. See `onSavePreparedChanges`. */
    private _transforming?: boolean;

    protected onSavePreparedChanges(changes: BulkPersistChanges, done: CallbackPartialResult<BulkPersistResult>) {
        try {
            /**
             * Transforms run here, between the change tracker and the plugin.
             *
             * Everything above works on the value your application holds; everything below
             * works on the value that is stored. The plugin is handed a schema view in which
             * a transformed property reports the type it stores, so it builds the right
             * column without knowing a transform exists.
             */
            // Computed once. The answer only changes when a collection is added, which
            // happens at construction, and recomputing it per save walks every property of
            // every schema and allocates on the hot path for a question with a fixed answer.
            this._transforming ??= hasTransforms(this._schemas);

            const transforming = this._transforming;

            /**
             * `previous` is for save-pipeline participants, and they have all run by now.
             *
             * Stripped rather than never added, because the participants read it off the same
             * assembled changes the plugin is about to be given. Leaving it on would put the
             * OLD value of every changed property into every plugin's payload — and over a
             * wire, for the HTTP family — to be ignored by all of them.
             */
            stripPreviousValues(changes);

            const event: DbPluginBulkPersistEvent = {
                id: uuid(8),
                operation: changes,
                schemas: transforming ? schemaCollectionView(this._schemas) : this._schemas,
                source: "DataStore",
                action: "persist"
            };

            /**
             * A save with nothing to transform stays SYNCHRONOUS to this point.
             *
             * Awaiting unconditionally cost a microtask tick before the plugin was called,
             * even when there was no transform to run. Under twenty workers saving in
             * parallel that tick was enough for another save to interleave between preparing
             * the changes and handing them over, and the change tracker could no longer
             * correlate an addition with its echo: S4 failed with "Cannot find internal
             * addition" on most workers. The stress suite is the only place that shows it,
             * because it is the only place with real concurrency.
             */
            const persist = () => this.dbPlugin.bulkPersist(event, (bulkPersistResult) => {

                if (bulkPersistResult.ok === Result.ERROR) {
                    done(Result.error(bulkPersistResult.error))
                    return;
                }

                if (bulkPersistResult.ok === Result.PARTIAL) {
                    done(Result.partial(bulkPersistResult.data, bulkPersistResult.error));
                    return;
                }

                // Audit rows leave before anything else looks at the save. They were never
                // submitted by a collection, so a store that also declares a collection over
                // the audit schema would otherwise try to match rows its change tracker never
                // sent — and the caller's reported add count would include them.
                this._audits.detach(changes, bulkPersistResult.data);
                this._fullTextSearches.detach(changes, bulkPersistResult.data);

                // The echo carries stored values, and the change tracker compares it against
                // what the entity holds. Reversing it keeps the two sides equal.
                const afterPersist = () =>
                this.collectionPipelines.afterPersist.filter<PartialResultType<{ changes: BulkPersistChanges, result: BulkPersistResult }>>({
                    data: { changes: changes, result: bulkPersistResult.data },
                    ok: Result.SUCCESS
                }, (afterPersistResult) => {

                    if (afterPersistResult.ok === PluginEventResult.ERROR) {
                        done(PluginEventResult.error(bulkPersistResult.id, afterPersistResult.error));
                        return;
                    }

                    if (afterPersistResult.ok === PluginEventResult.PARTIAL) {
                        done(PluginEventResult.partial(bulkPersistResult.id, afterPersistResult.data.result, afterPersistResult.error));
                        return;
                    }

                    done(PluginEventResult.success(bulkPersistResult.id, afterPersistResult.data.result))
                });

                /**
                 * Index rows for adds whose key the DATABASE assigned.
                 *
                 * The only part of index maintenance that cannot ride the document's own
                 * transaction: the row's key embeds the source id, and an identity key does
                 * not exist until the insert has run. A second write is the only way to know
                 * it, so an add is indexed a moment after it lands rather than with it.
                 *
                 * Its failure is reported to the CALLER, which is the difference that matters.
                 * The view path this replaced logged and carried on, so an index could silently
                 * disagree with the data; here a save whose index write fails is a failed save.
                 */
                const withDeferredAdds = (next: () => void) => {
                    const deferred = this._fullTextSearches.deferredAdds(bulkPersistResult.data);

                    if (deferred == null) {
                        next();
                        return;
                    }

                    this.dbPlugin.bulkPersist({
                        id: uuid(8),
                        operation: deferred,
                        schemas: this._schemas,
                        source: "DataStore",
                        action: "persist"
                    }, (deferredResult) => {

                        if (deferredResult.ok === Result.ERROR) {
                            done(Result.error(deferredResult.error));
                            return;
                        }

                        next();
                    });
                };

                if (transforming === false) {
                    withDeferredAdds(afterPersist);
                    return;
                }

                applyFromPersistResult(event, bulkPersistResult.data)
                    .then(() => withDeferredAdds(afterPersist))
                    .catch(error => done(Result.error(error)));
            });

            if (transforming === false) {
                persist();
                return;
            }

            applyToChanges(event).then(persist).catch(error => done(Result.error(error)));
        } catch (e) {
            done(Result.error(e))
        }
    }

    /**
     * Saves all changes in all collections.
     * @param done Callback with the number of changes saved or an error.
     */
    saveChanges(done: CallbackPartialResult<BulkPersistResult>) {
        this.collectionPipelines.prepareChanges.filter<PartialResultType<BulkPersistChanges>>({
            data: new BulkPersistChanges(),
            ok: Result.SUCCESS
        }, (preparedChangesResult) => {

            // fatal error
            if (preparedChangesResult.ok === PluginEventResult.ERROR) {
                done(preparedChangesResult);
                return;
            }

            // After the prepare pipeline, so every declaration sees the COMPLETE batch for its
            // collection. Running one during its own collection's prepare would show it only
            // part of the save, and what it saw would depend on declaration order.
            this._audits.apply(preparedChangesResult.data, this._schemas);

            // After auditing, and for the same reason it runs here: the batch is complete, so
            // index rows are computed from everything this save does rather than from whichever
            // collection happened to be declared first. They join the same
            // `BulkPersistChanges`, which is what makes the index commit with the documents.
            this._fullTextSearches.apply(preparedChangesResult.data);

            this.onSavePreparedChanges(preparedChangesResult.data, done);
        });
    }

    /**
     * Saves all changes in all collections asynchronously.
     * @returns A promise resolving to the number of changes saved.
     */
    saveChangesAsync() {
        return new Promise<BulkPersistResult>((resolve, reject) => {
            this.saveChanges((r) => Result.resolve(r, resolve, reject));
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method.
     * This method allows inspection of changes before they are actually persisted.
     * @param done Callback with the entity changes or an error.
     */
    previewChanges(done: CallbackPartialResult<BulkPersistChanges>) {
        this.collectionPipelines.prepareChanges.filter<PartialResultType<BulkPersistChanges>>({
            data: new BulkPersistChanges(),
            ok: Result.SUCCESS
        }, (r, e) => {
            if (e != null) {
                done(Result.error(e));
                return;
            }

            done(r);
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
     * This method allows inspection of changes before they are actually persisted.
     * @returns A promise resolving to the entity changes.
     */
    previewChangesAsync() {
        return new Promise<BulkPersistChanges>((resolve, reject) => {
            this.previewChanges((r) => Result.resolve(r, resolve, reject));
        });
    }

    /**
     * Checks if there are any unsaved changes in the collections.
     * @param done Callback with the result (true if there are changes) or an error.
     */
    hasChanges(done: CallbackResult<boolean>) {
        try {
            for (const [, collection] of this.collections) {
                if (collection.hasChanges()) {
                    done({
                        ok: Result.SUCCESS,
                        data: true
                    });
                    return;
                }
            }

            done({
                ok: Result.SUCCESS,
                data: false
            });
        } catch (error) {
            done({
                ok: Result.ERROR,
                error
            });
        }
    }

    /**
     * Checks asynchronously if there are any unsaved changes in the collections.
     * @returns A promise resolving to true if there are changes, false otherwise.
     */
    hasChangesAsync() {
        return new Promise<boolean>((resolve, reject) => {
            this.hasChanges((r) => {

                if (r.ok === Result.ERROR) {
                    reject(r.error);
                    return;
                }

                resolve(r.data);
            })
        });
    }

    /**
     * Destroys the Routier instance and underlying database plugin.
     *
     * Disposes the store as well, once the plugin is done. It used to destroy only the
     * database, which left every store this process had built holding an open
     * BroadcastChannel pair — two `MessagePort` handles that keep the Node event loop alive
     * on their own. That is a large part of why test runs need `--forceExit`: a channel pair
     * is opened eagerly for each collection, whether or not anything ever subscribes, and
     * `destroyAsync` is the call that reads like teardown. Only `[Symbol.dispose]` released
     * them, and nothing said so.
     *
     * Disposing AFTER the plugin callback rather than before it, because disposing aborts
     * this store's AbortController and the destroy operation is running under it.
     *
     * @param done Callback with an optional error.
     */
    destroy(done: CallbackResult<never>) {
        this.dbPlugin.destroy({
            id: uuid(8),
            schemas: this._schemas,
            source: "DataStore",
            action: "destroy"
        }, result => {
            this[Symbol.dispose]();
            done(result);
        });
    }

    /**
     * Destroys the Routier instance and underlying database plugin asynchronously.
     * @returns A promise that resolves when destruction is complete.
     */
    destroyAsync() {
        return new Promise<void>((resolve, reject) => {
            this.destroy((r) => Result.resolve(r, resolve, reject))
        });
    }

    /**
     * Disposes the Routier instance, aborting any ongoing operations and subscriptions.
     */
    [Symbol.dispose]() {
        // should clear and detach everything in the change tracker?
        this.abortController.abort("Data Store disposed");

        for (const [, collection] of this.collections) {
            collection.dispose();
        }
    }
}