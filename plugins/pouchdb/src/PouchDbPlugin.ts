import PouchDB from 'pouchdb';
import { PouchDbTranslator } from './PouchDbTranslator';
import { SyncronousQueue, SyncronousUnitOfWork, WorkPipeline } from '@routier/core/pipeline';
import { InferCreateType, InferType, PropertyInfo, SchemaId } from '@routier/core/schema';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, EntityUpdateInfo, IDbPlugin, IQuery } from '@routier/core/plugins';
import { CallbackResult, PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { assertIsNotNull } from '@routier/core/assertions';
import { combineExpressions, ComparatorExpression, Expression, getProperties } from '@routier/core/expressions';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection, UnknownRecord } from '@routier/core';

const queue = new SyncronousQueue();
const INDEX_NAME = "routier_pdb_indexes"
const cache: Record<string, unknown> = {};

type PouchDBPluginOptions = PouchDB.Configuration.DatabaseConfiguration & {
    queryType?: "default" | "memory-optimized" | "experimental";
    sync?: {
        remoteDb: string;
        live: boolean,
        retry: boolean,
        onChange: (schemas: SchemaCollection, change: PouchDB.Replication.SyncResult<{}>) => void
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

    constructor(name: string, options?: PouchDBPluginOptions) {
        this._name = name;
        this._options = options;
    }

    private _tryStartSync(schemas: SchemaCollection) {
        if (this._options?.sync != null) {

            if (cache["sync"] == null) {
                cache["sync"] = {}; // placeholder
                const localDb = new PouchDB(this._name);
                const remoteDb = new PouchDB(this._options.sync.remoteDb);

                // Set up sync
                const sync = localDb.sync(remoteDb, {
                    live: this._options.sync.live,
                    retry: this._options.sync.retry,
                    back_off_function: (delay) => Math.min(delay * 2, 10000)
                });

                sync.on('change', (change) => this._options.sync.onChange(schemas, change));

                cache["sync"] = sync;
            }
        }
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

                db.bulkDocs([...removes.map(w => ({ _id: w.entity._id, _rev: w.entity._rev, _deleted: true })), ...updatedDocuments], null, (error, response) => {

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

                                const changesResult = result.get(update.schemaId);

                                // Set the new rev
                                (update.change.entity as UnknownRecord)._rev = doc.rev;

                                changesResult.updates.push(update.change.entity);
                                continue;
                            }

                            const removesIndex = removes.findIndex(x => x.entity._id === doc.id);

                            if (removesIndex !== -1) {

                                const remove = removes[removesIndex];

                                const changesResult = result.get(remove.schemaId);

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
                        pipeline.pipe((d) => {
                            const schemaAdds = adds.filter(x => x.schemaId === schemaId).map(x => x.entity);
                            const schemaResult = result.get(schemaId);

                            assertIsNotNull(schemaResult);
                            assertIsNotNull(schemaAdds);

                            db.bulkDocs([...schemaAdds], null, (error, response) => {

                                if (error) {
                                    d(Result.error(error));
                                    return;
                                }

                                const ids = response.map(x => x.id);

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

                db.bulkDocs([
                    ...removes.map(x => ({ _id: x.entity._id, _rev: x.entity._rev, _deleted: true })),
                    ...updates.map(x => x.change.entity)
                ], null, (error, response) => {

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
                            const schemaResult = result.get(schemaId);

                            assertIsNotNull(schemaResult);

                            schemaResult.removes.push(doc as any);
                            continue;
                        }

                        const updatesIndex = updates.findIndex(x => x.change.entity._id === doc.id);

                        if (updatesIndex !== -1) {
                            // Optimistically assume that the update worked as expected
                            const update = updates[updatesIndex];

                            const changesResult = result.get(update.schemaId);

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
                        pipeline.pipe((d) => {
                            const schemaAdds = adds.filter(x => x.schemaId === schemaId).map(x => x.entity);
                            const schemaResult = result.get(schemaId);

                            assertIsNotNull(schemaResult);
                            assertIsNotNull(schemaAdds);

                            db.bulkDocs([...schemaAdds], null, (error, response) => {

                                if (error) {
                                    d(Result.error(error));
                                    return;
                                }

                                const ids = response.map(x => x.id);

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

        if (cache["indexes"]) {
            done(Result.success(cache["indexes"] as PouchDbDesignDoc));
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
                    db.put(ddoc as any, {}, (e) => {
                        if (e) {
                            d(Result.error(e));
                            return;
                        }

                        cache["indexes"] = ddoc;

                        d(Result.success(ddoc));
                    });
                    return;
                }

                const matchingIndex = response.rows.find(x => x.id === `_design/${INDEX_NAME}`);

                // make sure we have the correct index created
                if (matchingIndex == null) {
                    db.put(ddoc as any, {}, (e) => {
                        if (e) {
                            d(Result.error(e));
                            return;
                        }

                        cache["indexes"] = ddoc;

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

                            cache["indexes"] = ddoc;

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
        for (const [, schema] of event.schemas) {
            if (schema.idProperties.length > 1) {
                throw new Error("PouchDB cannot have more than one key per document.  Only '_id' is allowed to be the key")
            }
        }
    }

    private _bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>) {

        this._validateSchemas(event);
        this._tryStartSync(event.schemas);

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
        const { sync, queryType, ...rest } = this._options ?? {};
        const db = new PouchDB<TEntity>(this._name, rest);

        work(db, (result) => {

            if (shouldClose) {
                db.close(() => done(result));
            }

            done(result);
        })
    }

    destroy(_event: DbPluginEvent, done: (error?: any) => void): void {
        // this needs to be queued too
        this._doWork((w, d) => {
            w.destroy(null, (e) => {
                if (e) {
                    d(Result.error(e))
                    return;
                }

                d(Result.success());
            });
        }, done, false);
    }


    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>) {

        const unitOfWork: SyncronousUnitOfWork = (d) => this._bulkPersist(event, (r) => {
            d();
            done(r)
        })

        queue.enqueue(unitOfWork.bind(this));
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<TShape>): void {

        this._tryStartSync(event.schemas);

        const unitOfWork: SyncronousUnitOfWork = (d) => this._query<TRoot, TShape>(event, (r) => {
            d();
            done(r)
        })

        queue.enqueue(unitOfWork.bind(this));
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

    private _queryIndex<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, matchingIndex: MatchingIndex, done: CallbackResult<TShape>) {
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

                const translated = translator.translate(response.rows.map(w => w.doc));
                d(Result.success(translated));
            });
        }, done);
    }

    private _queryNoIndex<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>) {
        const filters = event.operation.options.get("filter")
        if (filters.length === 0) {
            this._queryWithNoFilters(event, done);
            return;
        }

        this._queryWithFilters(event, done);
    }

    private _queryWithNoFilters<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>) {
        const translator = new PouchDbTranslator<TEntity, TShape>(event.operation);
        this._doWork((w, d) => {
            w.allDocs({
                include_docs: true
            }).then(response => {
                const data = response.rows.map(w => w.doc);
                const translated = translator.translate(data);
                d(Result.success(translated));
            }).catch(error => {
                d(Result.error(error));
            });
        }, done);
    }

    private _queryWithFilters<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>) {
        const translator = new PouchDbTranslator<TEntity, TShape>(event.operation);
        this._doWork((w, d) => {

            if (this._name.startsWith("http")) {
                // Cannot query remote databases using translator.matches, fallback to alldocs
                // Does not throw, will fail on the remote server
                w.allDocs({
                    include_docs: true
                }).then(response => {
                    const data = response.rows.map(w => w.doc);
                    const translated = translator.translate(data);
                    d(Result.success(translated));
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
                const translated = translator.translate(data);
                d(Result.success(translated));
            });

        }, done);
    }

    private _query<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<TShape>): void {
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