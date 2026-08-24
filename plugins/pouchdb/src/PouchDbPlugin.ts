import PouchDB from 'pouchdb';
import { PouchDbTranslator } from './PouchDbTranslator';
import { SyncronousQueue, SyncronousUnitOfWork, WorkPipeline } from '@routier/core/pipeline';
import { InferCreateType, InferType, PropertyInfo, SchemaId } from '@routier/core/schema';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, EntityUpdateInfo, IDbPlugin, IQuery, ITranslatedValue, joinInPlugin } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { assertIsNotNull } from '@routier/core/assertions';
import { combineExpressions, ComparatorExpression, Expression, getProperties } from '@routier/core/expressions';
import { BulkPersistChanges, BulkPersistResult, ReadonlySchemaCollection, UnknownRecord } from '@routier/core';

const INDEX_NAME = "routier_pdb_indexes"

type PouchDBPluginOptions = PouchDB.Configuration.DatabaseConfiguration & {
    queryType?: "default" | "memory-optimized" | "experimental";
    sync?: PouchDB.Replication.SyncOptions & {
        remoteDb: string;
        onChange?: (schemas: ReadonlySchemaCollection, event: PouchDB.Replication.SyncResult<{}>) => void;
        onError?: (schemas: ReadonlySchemaCollection, error?: any) => void;
        onComplete?: (schemas: ReadonlySchemaCollection, event: PouchDB.Replication.SyncResultComplete<{}>) => void;
        onPaused?: (schemas: ReadonlySchemaCollection, event?: any) => void;
        onActive?: (schemas: ReadonlySchemaCollection) => void;
        onDenied?: (schemas: ReadonlySchemaCollection, event?: any) => void;
        auth?: {
            username: string;
            password: string;
        };
        headers?: { [key: string]: string };
    };
}

export type PouchDbDesignDoc = {
    _id: string;
    language?: string;
    views?: {
        [viewName: string]: {
            map: string | Function;
            reduce?: string | Function;
        };
    };
    filters?: {
        [filterName: string]: string | Function;
    };
    validate_doc_update?: string | Function;
    options?: Record<string, any>;
    [key: string]: any; // allow other CouchDB features
}

type MatchingIndex = {
    viewName: string,
    properties: {
        property: PropertyInfo<any>,
        value: unknown
    }[]
}

export class PouchDbPlugin implements IDbPlugin {

    private readonly _name: string;
    private readonly _options?: PouchDBPluginOptions;

    /**
     * Per INSTANCE, all three of these. They used to be module-level, which made every
     * PouchDbPlugin in the process share one database's state regardless of its name:
     *
     *  - the **queue** serialized work across unrelated databases, so a slow save against one
     *    database blocked a read against another;
     *  - the **index cache** was keyed by nothing at all, so the first database's design
     *    document was reported as every database's;
     *  - the **sync handle** lived under the literal key `"sync"`, so only the FIRST plugin in
     *    a process could establish replication — every later one got back the first one's
     *    handle, pointed at a different remote.
     *
     * A plugin instance is the natural scope: it owns exactly one database name.
     */
    private readonly queue = new SyncronousQueue();
    private indexCache: PouchDbDesignDoc | null = null;
    private syncHandle: PouchDB.Replication.Sync<{}> | null = null;

    /**
     * ONE local database handle for this plugin, shared by every operation and by `sync()`.
     *
     * This used to be a fresh `new PouchDB(name)` per operation, with `sync()` constructing
     * yet another one of its own. Two PouchDB objects over the same name only behave as one
     * database when the ADAPTER broadcasts changes between them: IndexedDB does, so this
     * works in a browser, and the in-memory adapter does not, so under it a live replication
     * never observes the plugin's own writes and the plugin never observes what replication
     * pulls in. Replication and data access were effectively wired to two different databases
     * on any adapter without that broadcast.
     *
     * One handle removes the question, and removes the per-operation construction churn with
     * it. It is closed and cleared by `destroy()`.
     */
    private localDb: PouchDB.Database<any> | null = null;

    private database<TEntity>(): PouchDB.Database<TEntity> {
        if (this.localDb == null) {
            const { sync: _sync, queryType: _queryType, ...rest } = this._options ?? {};
            this.localDb = new PouchDB(this._name, rest);
        }

        return this.localDb as PouchDB.Database<TEntity>;
    }

    constructor(name: string, options?: PouchDBPluginOptions) {
        this._name = name;
        this._options = options;
    }

    /**
     * See `IDbPlugin.databaseName`. The local database name — the same value two contexts
     * opening one PouchDB database supply, so they share subscription channels. Remote sync
     * targets are deliberately not part of it: two local databases replicating to one remote
     * are still two databases.
     */
    get databaseName(): string {
        return this._name;
    }

    sync(schemas: ReadonlySchemaCollection) {

        assertIsNotNull(this._options?.sync, "Cannot start sync process without sync options.  Provide sync options in PouchDbPlugin constructor");

        if (this.syncHandle == null) {
            // No placeholder write before the work. The previous shape assigned `{}` first
            // and only replaced it after `sync()` returned, so if constructing either
            // database threw, the cache kept the placeholder forever and every later call
            // returned an empty object cast as a Sync — no replication, no error, no way back
            // without restarting the process.
            // The plugin's own handle, not a second one over the same name: replication has
            // to observe the writes this plugin makes, and on an adapter that does not
            // broadcast changes between instances (the in-memory one, for example) a
            // separate object is a separate database in every way that matters here.
            const localDb = this.database();
            const remoteDb = new PouchDB(this._options.sync.remoteDb);

            // Set up sync
            const sync = localDb.sync(remoteDb, {
                ...this._options.sync
            });

            if (this._options.sync.onChange) {
                sync.on('change', (e) => this._options.sync.onChange(schemas, e));
            }

            if (this._options.sync.onActive) {
                sync.on('active', () => this._options.sync.onActive(schemas));
            }

            if (this._options.sync.onComplete) {
                sync.on('complete', (e) => this._options.sync.onComplete(schemas, e));
            }

            if (this._options.sync.onDenied) {
                sync.on('denied', (e) => this._options.sync.onDenied(schemas, e));
            }

            if (this._options.sync.onError) {
                sync.on('error', (e) => this._options.sync.onError(schemas, e));
            }

            if (this._options.sync.onPaused) {
                sync.on('paused', (e) => this._options.sync.onPaused(schemas, e));
            }

            // Retained so destroy() can cancel it. An uncancelled sync keeps polling a
            // remote that the caller believes it has finished with, and holds both databases
            // open with it.
            this.syncHandle = sync;
        }

        return this.syncHandle;
    }

    /**
     * Fills in the `_rev` of any document about to be updated or removed that arrives without
     * one, in a single lookup.
     *
     * PouchDB is the only backend in this repository that needs a revision to change a row, and
     * it used to make that the CALLER's problem: a schema had to declare `_rev` and every
     * entity had to carry the current value. That is this plugin's write protocol leaking into
     * every schema written for it, and it made whole features unusable here — a generated
     * search-index row is built from the document being saved, so it has an id and never a
     * revision, and every edit to an indexed document failed with a conflict whose only
     * detail was `true`.
     *
     * A revision is a fact this database owns, so this is the layer that should look it up.
     * One `allDocs` for every id that needs one, only when at least one does, and never on the
     * path where every entity already carries its own. Nothing above has to know.
     *
     * A missing row resolves to no revision and is left alone: an update to a document that is
     * not there must still fail, and it fails the way it always did.
     */
    private _withRevisions(
        db: PouchDB.Database,
        documents: UnknownRecord[],
        done: (error: unknown | null) => void
    ) {
        const missing = documents
            .filter(document => document._rev == null && document._id != null)
            .map(document => String(document._id));

        if (missing.length === 0) {
            done(null);
            return;
        }

        db.allDocs({ keys: missing }).then(response => {
            const revisions = new Map<string, string>();

            for (const row of response?.rows ?? []) {
                const revision = (row as { value?: { rev?: string, deleted?: boolean } }).value;

                if (revision?.rev != null && revision.deleted !== true) {
                    revisions.set(String(row.key), revision.rev);
                }
            }

            for (const document of documents) {

                if (document._rev == null) {
                    const revision = revisions.get(String(document._id));

                    if (revision != null) {
                        document._rev = revision;
                    }
                }
            }

            done(null);
        }).catch(error => done(error));
    }

    private _identityBulkOperations(identitySchemaIds: SchemaId[], changes: BulkPersistChanges, result: BulkPersistResult, done: CallbackResult<never>): void {

        if (changes.aggregate.size === 0) {
            done(Result.success())
            return;
        }

        // Link each entity to a schema id below so we can easily look up the schema id for an entity
        const updates: { change: EntityUpdateInfo<UnknownRecord>, schemaId: SchemaId }[] = [];
        const adds: { entity: InferCreateType<UnknownRecord>, schemaId: SchemaId }[] = [];
        const removes: { entity: InferType<UnknownRecord>, schemaId: SchemaId }[] = [];

        for (const [schemaId, schemaChanges] of changes) {

            if (identitySchemaIds.includes(schemaId) === false || schemaChanges.hasItems === false) {
                continue;
            }

            updates.push(...schemaChanges.updates.map(x => ({ change: x, schemaId })));
            adds.push(...schemaChanges.adds.map(x => ({ entity: x, schemaId })));
            removes.push(...schemaChanges.removes.map(x => ({ entity: x, schemaId })));
        }

        // Do adds separate.  Updates/Removes already have an id that we can reference
        // Default can do the same as updates/removes below since it has an id
        // Check again now to see if we have any identity schema changes
        if (updates.length === 0 && removes.length === 0 && adds.length === 0) {
            done(Result.success())
            return;
        }

        this._doWork((db, d) => {
            try {

                const updatedDocuments = [...updates].map(w => w.change.entity);
                const errors: any[] = [];

                // Tombstones are built here rather than inline so a missing revision can be
                // resolved into them before the write.
                const tombstones = removes.map(w => ({ _id: w.entity._id, _rev: w.entity._rev, _deleted: true } as UnknownRecord));

                this._withRevisions(db, [...tombstones, ...updatedDocuments] as UnknownRecord[], (revisionError) => {

                if (revisionError != null) {
                    d(Result.error(revisionError));
                    return;
                }

                db.bulkDocs([...tombstones, ...updatedDocuments], null, (error, response) => {

                    if (error) {
                        d(Result.error(error));
                        return;
                    }

                    for (let i = 0, length = response.length; i < length; i++) {
                        const doc = response[i];

                        if ("error" in doc && doc.error === true) {
                            errors.push(doc); // send back the entire error
                            continue;
                        }

                        if ("id" in doc && "ok" in doc) {
                            const updatesIndex = updates.findIndex(x => x.change.entity._id === doc.id);

                            if (updatesIndex !== -1) {
                                // Optimistically assume that the update worked as expected
                                const update = updates[updatesIndex];

                                const changesResult = result.resolve(update.schemaId);

                                // Set the new rev
                                (update.change.entity as UnknownRecord)._rev = doc.rev;

                                changesResult.updates.push(update.change.entity);
                                continue;
                            }

                            const removesIndex = removes.findIndex(x => x.entity._id === doc.id);

                            if (removesIndex !== -1) {

                                const remove = removes[removesIndex];

                                const changesResult = result.resolve(remove.schemaId);

                                changesResult.removes.push(remove.entity);
                            }
                        }
                    }

                    if (errors.length > 0) {
                        d(Result.error(errors));
                        return;
                    }

                    const pipeline = new WorkPipeline();

                    for (let i = 0, length = identitySchemaIds.length; i < length; i++) {
                        const schemaId = identitySchemaIds[i];
                        const schemaAdds = adds.filter(x => x.schemaId === schemaId).map(x => x.entity);

                        // Skip schemas with no adds
                        if (schemaAdds.length === 0) {
                            continue;
                        }

                        pipeline.pipe((d) => {
                            const schemaResult = result.resolve(schemaId);

                            assertIsNotNull(schemaResult);
                            assertIsNotNull(schemaAdds);

                            db.bulkDocs([...schemaAdds], null, (error, response) => {

                                if (error) {
                                    d(Result.error(error));
                                    return;
                                }

                                // Starts EMPTY and is filled from the ok entries below.
                                // Seeding it from every response entry and then pushing each
                                // ok id again put every id in twice, so `_bulkGetAdditions`
                                // asked for each document twice and the echo carried
                                // duplicates into the change tracker.
                                const ids: string[] = [];

                                for (let i = 0, length = response.length; i < length; i++) {

                                    const doc = response[i];

                                    if ("error" in doc) {

                                        const reason = doc.reason ?? doc.error;

                                        d(Result.error(reason));
                                        return;
                                    }

                                    if ("id" in doc && "ok" in doc) {
                                        ids.push(doc.id);
                                    } else {
                                        d(Result.error(doc.error));
                                        return;
                                    }
                                }

                                this._bulkGetAdditions(ids, (bulkGetResponse) => {

                                    if (bulkGetResponse.ok !== Result.SUCCESS) {
                                        d(Result.error(bulkGetResponse));
                                        return;
                                    }

                                    for (let i = 0, length = bulkGetResponse.data.results.length; i < length; i++) {
                                        const docs = bulkGetResponse.data.results[i].docs;

                                        if (docs.length === 1) {
                                            const doc = docs[0];

                                            if ("ok" in doc) {
                                                schemaResult.adds.push(doc.ok as any);
                                            }
                                        }
                                    }

                                    d(Result.success());
                                });
                            });

                        });
                    }

                    pipeline.filter((r) => {
                        if (r.ok !== Result.SUCCESS) {
                            d(r);
                            return;
                        }

                        d(Result.success());
                    });
                });
                });
            } catch (e) {
                d(Result.error(e));
            }
        }, done);
    }

    private _defaultBulkOperations(nonIdentitySchemaIds: SchemaId[], changes: BulkPersistChanges, result: BulkPersistResult, done: CallbackResult<never>): void {

        if (changes.aggregate.size === 0) {
            done(Result.success())
            return;
        }

        // Link each entity to a schema id below so we can easily look up the schema id for an entity
        const updates: { change: EntityUpdateInfo<UnknownRecord>, schemaId: SchemaId }[] = [];
        const adds: { entity: InferCreateType<UnknownRecord>, schemaId: SchemaId }[] = [];
        const removes: { entity: InferType<UnknownRecord>, schemaId: SchemaId }[] = [];

        for (const [schemaId, schemaChanges] of changes) {

            if (nonIdentitySchemaIds.includes(schemaId) === false || schemaChanges.hasItems === false) {
                continue;
            }

            updates.push(...schemaChanges.updates.map(x => ({ change: x, schemaId })));
            adds.push(...schemaChanges.adds.map(x => ({ entity: x, schemaId })));
            removes.push(...schemaChanges.removes.map(x => ({ entity: x, schemaId })));
        }

        if (updates.length === 0 && removes.length === 0 && adds.length === 0) {
            done(Result.success())
            return;
        }

        this._doWork((db, d) => {
            try {

                const tombstones = removes.map(x => ({ _id: x.entity._id, _rev: x.entity._rev, _deleted: true } as UnknownRecord));
                const updatedDocuments = updates.map(x => x.change.entity) as UnknownRecord[];

                this._withRevisions(db, [...tombstones, ...updatedDocuments], (revisionError) => {

                if (revisionError != null) {
                    d(Result.error(revisionError));
                    return;
                }

                db.bulkDocs([...tombstones, ...updatedDocuments], null, (error, response) => {

                    if (error != null) {
                        d(Result.error(error));
                        return;
                    }

                    for (let i = 0, length = response.length; i < length; i++) {
                        const doc = response[i];

                        if ("error" in doc) {

                            const reason = doc.reason ?? doc.error;

                            d(Result.error(reason));
                            return;
                        }

                        const removesIndex = removes.findIndex(x => x.entity._id === doc.id);

                        if (removesIndex !== -1) {
                            const { schemaId } = removes[removesIndex]
                            const schemaResult = result.resolve(schemaId);

                            assertIsNotNull(schemaResult);

                            schemaResult.removes.push(doc as any);
                            continue;
                        }

                        const updatesIndex = updates.findIndex(x => x.change.entity._id === doc.id);

                        if (updatesIndex !== -1) {
                            // Optimistically assume that the update worked as expected
                            const update = updates[updatesIndex];

                            const changesResult = result.resolve(update.schemaId);

                            // Set the new rev
                            (update.change.entity as UnknownRecord)._rev = doc.rev;

                            changesResult.updates.push(update.change.entity);
                            continue;
                        }

                        d(Result.error(new Error("Cannot classify resulting doc")));
                        return;
                    }

                    const pipeline = new WorkPipeline();

                    for (let i = 0, length = nonIdentitySchemaIds.length; i < length; i++) {
                        const schemaId = nonIdentitySchemaIds[i];
                        const schemaAdds = adds.filter(x => x.schemaId === schemaId).map(x => x.entity);

                        // Skip schemas with no adds
                        if (schemaAdds.length === 0) {
                            continue;
                        }

                        pipeline.pipe((d) => {
                            const schemaResult = result.resolve(schemaId);

                            assertIsNotNull(schemaResult);
                            assertIsNotNull(schemaAdds);

                            db.bulkDocs([...schemaAdds], null, (error, response) => {

                                if (error) {
                                    d(Result.error(error));
                                    return;
                                }

                                // Starts EMPTY and is filled from the ok entries below.
                                // Seeding it from every response entry and then pushing each
                                // ok id again put every id in twice, so `_bulkGetAdditions`
                                // asked for each document twice and the echo carried
                                // duplicates into the change tracker.
                                const ids: string[] = [];

                                for (let i = 0, length = response.length; i < length; i++) {

                                    const doc = response[i];

                                    if ("error" in doc) {

                                        const reason = doc.reason ?? doc.error;

                                        d(Result.error(reason));
                                        return;
                                    }

                                    if ("id" in doc && "ok" in doc) {
                                        ids.push(doc.id);
                                    } else {
                                        d(Result.error(doc.error));
                                        return;
                                    }
                                }

                                this._bulkGetAdditions(ids, (bulkGetResponse) => {

                                    if (bulkGetResponse.ok !== Result.SUCCESS) {
                                        d(Result.error(bulkGetResponse));
                                        return;
                                    }

                                    for (let i = 0, length = bulkGetResponse.data.results.length; i < length; i++) {
                                        const docs = bulkGetResponse.data.results[i].docs;

                                        if (docs.length === 1) {
                                            const doc = docs[0];

                                            if ("ok" in doc) {
                                                schemaResult.adds.push(doc.ok as any);
                                            }
                                        }
                                    }

                                    d(Result.success());
                                });
                            });

                        });
                    }

                    pipeline.filter((r) => {
                        if (r.ok !== Result.SUCCESS) {
                            d(r);
                            return;
                        }

                        d(Result.success());
                    });
                });
                });
            } catch (e) {
                d(Result.error(e));
            }
        }, done);
    }

    private _prepareProperties(...properties: PropertyInfo<any>[]) {

        properties.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        const paths = properties.map(w => w.getAssignmentPath({ parent: "doc" }));
        const viewName = `by_${paths.join("_")}`;

        return {
            properties,
            paths,
            viewName
        }
    }

    private resolveIndexes<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<PouchDbDesignDoc | null>) {

        const indexes = event.operation.schema.getIndexes();

        if (indexes.length === 0) {
            done(Result.success(null));
            return;
        }

        if (this.indexCache != null) {
            done(Result.success(this.indexCache));
            return; // Already built
        }

        const ddoc: PouchDbDesignDoc = {
            _id: `_design/${INDEX_NAME}`,
            views: {}
        }

        for (let i = 0, length = indexes.length; i < length; i++) {
            const index = indexes[i];
            const { viewName, paths } = this._prepareProperties(...index.properties);

            if (index.properties.length === 1) {
                const property = index.properties[0];
                const path = property.getAssignmentPath({ parent: "doc" });
                ddoc.views[viewName] = {
                    map: `function(doc) {
                        if (${path}) {
                            emit(${path});
                        }
                    }`
                }
                continue;
            }

            ddoc.views[viewName] = {
                map: `function(doc) {
                    if (${paths.join(" && ")}) {
                        emit([${paths.join(",")}]);
                    }
                }`
            }
        }

        this._doWork((db, d) => {
            // change this out in the future? or make a new index, this does not return the rev which makes us need to call get again below
            db.allDocs({
                startkey: '_design/',
                endkey: '_design0',
                include_docs: true
            }).then(response => {

                // if we have no indexes, let's create it
                if (response.rows.length === 0) {
                    db.put(ddoc as UnknownRecord, {}, (e) => {
                        if (e) {
                            d(Result.error(e));
                            return;
                        }

                        this.indexCache = ddoc;

                        d(Result.success(ddoc));
                    });
                    return;
                }

                const matchingIndex = response.rows.find(x => x.id === `_design/${INDEX_NAME}`);

                // make sure we have the correct index created
                if (matchingIndex == null) {
                    db.put(ddoc as UnknownRecord, {}, (e) => {
                        if (e) {
                            d(Result.error(e));
                            return;
                        }

                        this.indexCache = ddoc;

                        d(Result.success(ddoc));
                    });
                    return;
                }

                assertIsNotNull(ddoc.views);
                assertIsNotNull(matchingIndex.doc);

                const views = Object.keys(ddoc.views)

                // make sure all of the views are in the document, if not update it
                if (views.some(x => (matchingIndex.doc as any).views[x] == null)) {

                    // need to get the rev
                    db.get(ddoc._id, {}, (e, result) => {

                        if (e != null) {
                            d(Result.error(e));
                            return;
                        }

                        (result as any).views = ddoc.views

                        db.put(result as any, {}, (e) => {

                            if (e) {
                                d(Result.error(e));
                                return;
                            }

                            this.indexCache = ddoc;

                            d(Result.success(ddoc));
                        });
                    })
                    return;
                }

                d(Result.success(ddoc));
            }).catch(e => {
                d(Result.error(e));
            });
        }, done)
    }

    // id should be a string here because this is only run on identity inserts
    private _bulkGetAdditions<TEntity extends {}>(ids: string[], done: CallbackResult<PouchDB.Core.BulkGetResponse<TEntity>>) {

        if (ids.length === 0) {
            done(Result.success({ results: [] }));
            return;
        }

        this._doWork((db, d) => {
            db.bulkGet<TEntity>({
                docs: ids.map(w => ({ id: w as string }))
            }, (error, response) => {

                if (error) {
                    d(Result.error(error));
                    return
                }

                d(Result.success(response));
            });
        }, done);
    }

    private _validateSchemas(event: DbPluginBulkPersistEvent) {
        for (const [schemaId, schema] of event.schemas) {

            // Only schemas this persist actually writes: a store may declare other collections,
            // and an unused bad one should not block saves to the good ones.
            if (event.operation.get(schemaId)?.hasItems !== true) {
                continue;
            }

            if (schema.idProperties.length > 1) {
                throw new Error("PouchDB cannot have more than one key per document.  Only '_id' is allowed to be the key")
            }

            // An identity key is generated by PouchDB as '_id' and echoed back as '_id', so an
            // identity key under any other name is never filled in: every entity reads back with
            // an undefined key and the change tracker merges them all into one. Corruption, not
            // an error — so refuse the schema up front. A caller-supplied key (default/computed)
            // is stored as an ordinary field and round-trips fine under any name.
            const key = schema.idProperties[0];
            if (key != null && key.isIdentity && key.name !== "_id") {
                throw new Error(
                    `PouchDB generates identity keys as '_id'. The schema for collection '${schema.collectionName}' uses ` +
                    `'${key.name}' as its identity key, which PouchDB cannot fill in. ` +
                    `Declare the key as: _id: s.string().key().identity()`
                );
            }
        }
    }

    private _bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>) {

        this._validateSchemas(event);

        const result = event.operation.toResult();
        const identitySchemaIds: SchemaId[] = [];
        const defaultSchemaIds: SchemaId[] = [];

        for (const [schemaId, schema] of event.schemas) {

            if (schema.hasIdentityKeys) {
                identitySchemaIds.push(schemaId);
                continue;
            }

            defaultSchemaIds.push(schemaId);
        }

        this._identityBulkOperations(identitySchemaIds, event.operation, result, (identityResult) => {

            if (identityResult.ok !== Result.SUCCESS) {
                done(PluginEventResult.error(event.id, identityResult.error))
                return;
            }

            this._defaultBulkOperations(defaultSchemaIds, event.operation, result, (defaultResult) => {

                if (defaultResult.ok !== Result.SUCCESS) {
                    done(PluginEventResult.error(event.id, defaultResult.error))
                    return;
                }

                done(PluginEventResult.success(event.id, result))
            });

        });
    }

    private _doWork<TResult, TEntity>(work: (db: PouchDB.Database<TEntity>, done: CallbackResult<TResult>) => void, done: CallbackResult<TResult>, shouldClose: boolean = false) {
        const db = this.database<TEntity>();

        work(db, (result) => {

            // The `return` is the fix. Without it, `shouldClose` ran BOTH branches: `done`
            // fired synchronously here and again from the close callback. A doubled callback
            // resolves a settled promise silently, but it also drives every pipeline stage
            // downstream twice — see known-defects #3's "calls done exactly once".
            if (shouldClose) {
                // The handle is shared, so closing it has to clear the cache too — the next
                // operation must open a fresh one rather than reuse a closed database.
                this.localDb = null;
                db.close(() => done(result));
                return;
            }

            done(result);
        })
    }

    destroy(_event: DbPluginEvent, done: (error?: any) => void): void {
        // Replication first. A live sync holds both the local and the remote database open
        // and keeps polling; destroying the local one underneath it leaves a replication
        // running against a database that no longer exists, which surfaces later as errors
        // from a plugin the caller believes it has finished with.
        if (this.syncHandle != null) {
            try {
                this.syncHandle.cancel();
            } catch {
                // An already-finished sync throws on cancel. Destroy's goal is that no
                // replication is running, and that is satisfied either way.
            }

            this.syncHandle = null;
        }

        // A destroyed database must not keep serving its cached design document to a plugin
        // that outlives it.
        this.indexCache = null;

        // `shouldClose: true`, so the handle this work opened is closed rather than left to
        // the garbage collector. It was false, which is what left destroy leaking the very
        // resource it was called to release.
        this._doWork((w, d) => {
            w.destroy(null, (e) => {
                if (e) {
                    d(Result.error(e))
                    return;
                }

                d(Result.success());
            });
        }, done, true);
    }


    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>) {

        const unitOfWork: SyncronousUnitOfWork = (d) => this._bulkPersist(event, (r) => {
            d();
            done(r)
        })

        this.queue.enqueue(unitOfWork.bind(this));
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {

        const unitOfWork: SyncronousUnitOfWork = (d) => {
            const settle = (r: Parameters<typeof done>[0]) => {
                d();
                done(r);
            };

            // A join is two reads through `_query` — the UN-QUEUED path — on purpose: this unit of
            // work already holds the queue, so routing them through `query` would make them wait on
            // itself and the plugin would never answer. They are still serialized against every
            // other query, because this slot is held for both.
            if (event.operation.options.has("join")) {
                joinInPlugin(event, (e, cb) => this._query(e, cb), settle as never);
                return;
            }

            this._query<TRoot, TShape>(event, settle);
        };

        this.queue.enqueue(unitOfWork.bind(this));
    }

    protected onGetIndex<TEntity extends {}, TShape extends unknown = TEntity>(_: IQuery<TEntity, TShape>, __: PouchDB.Find.FindRequest<unknown>, done: (result: null | string | [string, string]) => void) {
        done(null);
    }

    extractEqualityValueForProperty(expression: Expression, prop: PropertyInfo<any>): any | undefined {
        // Recursively search for a comparator expression that matches the property
        if (expression.type === "comparator" && (expression as ComparatorExpression).comparator === "equals") {
            // Check left side is property, right side is value
            if (expression.left && expression.left.type === "property" && (expression.left as any).property.name === prop.name && expression.right && expression.right.type === "value") {
                return (expression.right as any).value;
            }
            // Or right side is property, left side is value
            if (expression.right && expression.right.type === "property" && (expression.right as any).property.name === prop.name && expression.left && expression.left.type === "value") {
                return (expression.left as any).value;
            }
        }
        // Recursively check left and right
        if (expression.left) {
            const left = this.extractEqualityValueForProperty(expression.left, prop);
            if (left !== undefined) return left;
        }
        if (expression.right) {
            const right = this.extractEqualityValueForProperty(expression.right, prop);
            if (right !== undefined) return right;
        }
        return undefined;
    }

    private _findMatchingIndex(ddoc: PouchDbDesignDoc, expression: Expression): MatchingIndex {
        const queryProperties = getProperties(expression);

        const { viewName } = this._prepareProperties(...queryProperties);

        if (ddoc.views == null) {
            return null;
        }

        const index = ddoc.views[viewName];

        if (index == null) {
            return null;
        }

        const properties: MatchingIndex["properties"] = [];

        for (const property of queryProperties) {
            const value = this.extractEqualityValueForProperty(expression, property);

            if (value === undefined) {
                return null
            }

            properties.push({
                property,
                value
            });
        }

        return {
            viewName,
            properties
        };
    }

    private _queryIndex<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, matchingIndex: MatchingIndex, done: CallbackResult<ITranslatedValue<TShape>>) {
        const translator = new PouchDbTranslator<TEntity, TShape>(event.operation);
        this._doWork((w, d) => {

            const options: PouchDB.Query.Options<any, any> = {
                include_docs: true,
            };

            const values = matchingIndex.properties.map(x => x.value);

            if (values.some(x => x == null) == false) {

                if (values.length === 1) {
                    options.key = values[0];
                } else {
                    options.keys = values;
                }
            }

            w.query(`${INDEX_NAME}/${matchingIndex.viewName}`, options, (error, response) => {

                if (error != null) {
                    d(Result.error(error));
                    return;
                }

                try {
                    event.executedQueries.push({ text: `${INDEX_NAME}/${matchingIndex.viewName}: indexed view query` });

                    const translated = translator.translate(response.rows.map(w => w.doc));
                    d(Result.success(translated));
                } catch (e) {
                    d(Result.error(e));
                }
            });
        }, done);
    }

    private _queryNoIndex<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<ITranslatedValue<TShape>>) {
        const filters = event.operation.options.get("filter")
        if (filters.length === 0) {
            this._queryWithNoFilters(event, done);
            return;
        }

        this._queryWithFilters(event, done);
    }

    private _queryWithNoFilters<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<ITranslatedValue<TShape>>) {
        const translator = new PouchDbTranslator<TEntity, TShape>(event.operation);
        this._doWork((w, d) => {
            w.allDocs({
                include_docs: true
            }).then(response => {

                try {
                    event.executedQueries.push({ text: "allDocs({ include_docs: true }): full database scan, no index" });

                    const data = response.rows.map(w => w.doc);
                    const translated = translator.translate(data);
                    d(Result.success(translated));
                } catch (e) {
                    d(Result.error(e));
                }
            }).catch(error => {
                d(Result.error(error));
            });
        }, done);
    }

    private _queryWithFilters<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<ITranslatedValue<TShape>>) {
        const translator = new PouchDbTranslator<TEntity, TShape>(event.operation);
        this._doWork((w, d) => {

            if (this._name.startsWith("http")) {
                // Cannot query remote databases using translator.matches, fallback to alldocs
                // Does not throw, will fail on the remote server
                w.allDocs({
                    include_docs: true
                }).then(response => {
                    const data = response.rows.map(w => w.doc);
                    try {
                        event.executedQueries.push({ text: "allDocs({ include_docs: true }): full database scan, no index" });

                        const translated = translator.translate(data);
                        d(Result.success(translated));
                    } catch (e) {
                        d(Result.error(e));
                    }
                }).catch(error => {
                    d(Result.error(error));
                });
                return;
            }

            w.query<{}, any>((doc, emit) => {
                if (typeof doc === "object" && "_id" in doc && translator.matches(doc)) {
                    emit(doc._id, doc);
                }
            }, (error, response) => {

                if (error != null) {
                    d(Result.error(error));
                    return;
                }

                const data = response.rows.map(w => w.value);

                try {
                    event.executedQueries.push({ text: "view query" });

                    const translated = translator.translate(data);
                    d(Result.success(translated));
                } catch (e) {
                    d(Result.error(e));
                }
            });

        }, done);
    }

    private _query<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.resolveIndexes(event, (r) => {
            if (r.ok !== Result.SUCCESS) {
                done(PluginEventResult.error(event.id, r.error))
                return;
            }

            const ddoc = r.data;

            if (ddoc == null) {
                this._queryNoIndex(event, done);
                return;
            }

            const mapMatchingIndex = this.findMatchingIndexForMap(ddoc, event);

            if (mapMatchingIndex != null) {
                this._queryIndex(event, mapMatchingIndex, done);
                return;
            }

            const expression = this._getExpressionFromQuery(event);

            if (Expression.isEmpty(expression)) {
                this._queryNoIndex(event, done);
                return;
            }

            const matchingIndex = this._findMatchingIndex(ddoc, expression);

            if (matchingIndex == null) {
                this._queryNoIndex(event, done);
                return;
            }

            this._queryIndex(event, matchingIndex, done);
        });
    }

    private _getExpressionFromQuery<TEntity extends {}, TShape>(event: DbPluginQueryEvent<TEntity, TShape>) {
        const filters = event.operation.options.get("filter");

        const databaseFilters = filters.filter(x => x.option.target === "database");

        if (databaseFilters.length === 0) {
            return Expression.EMPTY;
        }

        const expressions = databaseFilters.map(x => x.option.value.expression);

        return combineExpressions(...expressions);
    }

    private findMatchingIndexForMap<TEntity extends {}, TShape>(ddoc: PouchDbDesignDoc, event: DbPluginQueryEvent<TEntity, TShape>): MatchingIndex | null {
        const map = event.operation.options.getLast("map");
        const filters = event.operation.options.get("filter");

        // we only want to look at the index if there are no filters
        if (filters.length > 0) {
            return null;
        }

        if (map == null || map.target !== "database") {
            return null;
        }

        if (map.value.fields.length !== 1 || map.value.fields[0].property == null) {
            return null;
        }

        const property = map.value.fields[0].property;

        const { viewName } = this._prepareProperties(property);

        if (ddoc.views == null) {
            return null;
        }

        const index = ddoc.views[viewName];

        if (index == null) {
            return null;
        }

        return {
            viewName,
            properties: [{ property, value: null }]
        }
    }
}