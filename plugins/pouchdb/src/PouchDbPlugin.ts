import PouchDB from 'pouchdb';
import { PouchDbTranslator } from './PouchDbTranslator';
import { AsyncPipeline, SyncronousQueue, SyncronousUnitOfWork } from 'routier-core/pipeline';
import { InferCreateType, InferType, PropertyInfo, SchemaId } from 'routier-core/schema';
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, IQuery } from 'routier-core/plugins';
import { ResolvedChanges } from 'routier-core/collections';
import { CallbackPartialResult, CallbackResult, Result } from 'routier-core/results';
import { assertIsNotNull } from 'routier-core/assertions';
import { combineExpressions, ComparatorExpression, Expression, getProperties } from 'routier-core/expressions';

const queue = new SyncronousQueue();
const INDEX_NAME = "routier_pdb_indexes"
const cache: Record<string, unknown> = {};

type PouchDBPluginOptions = PouchDB.Configuration.DatabaseConfiguration & {
    queryType?: "default" | "memory-optimized" | "experimental"
}

type PouchDbDoc<T extends {}> = { _id: string, _rev?: string } & T;

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

    private _identityBulkOperations<T extends {}>(schemaIds: SchemaId[], resolvedChanges: ResolvedChanges<T>, done: CallbackResult<never>): void {

        const { data: updates } = resolvedChanges.changes.updates(schemaIds);
        const { data: removes } = resolvedChanges.changes.removes(schemaIds);
        const { data: adds } = resolvedChanges.changes.adds(schemaIds);
        // Do adds separate.  Updates/Removes already have an id that we can reference
        // Default can do the same as updates/removes below since it has an id

        if (updates.length === 0 && removes.length === 0 && adds.length === 0) {
            done(Result.success())
            return;
        }

        this._doWork((db, d) => {
            try {

                const removals = removes.map(x => x[1] as PouchDbDoc<InferType<T>>);
                const updatedDocuments = updates.map(w => w[1].entity as PouchDbDoc<InferType<T>>);

                db.bulkDocs([...removals.map(w => ({ _id: w._id, _rev: w._rev, _deleted: true })), ...updatedDocuments], null, (error, response) => {

                    if (error) {
                        d(Result.error(error));
                        return;
                    }

                    for (let i = 0, length = response.length; i < length; i++) {
                        const doc = response[i];

                        if ("id" in doc && "ok" in doc) {
                            const updatesIndex = updates.findIndex(x => (x[1].entity as PouchDbDoc<InferType<T>>)._id === doc.id);

                            if (updatesIndex !== -1) {
                                // Optimistically assume that the update worked as expected
                                const [schemaId, changes] = updates[updatesIndex];

                                const changesResult = resolvedChanges.result.get(schemaId);

                                changesResult.updates.entities.push(changes.entity);
                                continue;
                            }

                            const removesIndex = removes.findIndex(x => (x[1] as PouchDbDoc<InferType<T>>)._id === doc.id);

                            if (removesIndex !== -1) {

                                const [schemaId, entity] = removes[removesIndex];

                                const changesResult = resolvedChanges.result.get(schemaId);

                                changesResult.removes.entities.push(entity);
                            }
                        }
                    }

                    const addsMap = new Map<SchemaId, InferCreateType<T>[]>();

                    // Group adds by schemaId
                    for (const [schemaId, item] of adds) {
                        if (!addsMap.has(schemaId)) {
                            addsMap.set(schemaId, []);
                        }

                        const items = addsMap.get(schemaId);

                        assertIsNotNull(items);

                        items.push(item);
                    }

                    const pipeline = new AsyncPipeline<SchemaId, Map<SchemaId, void>>();
                    pipeline.pipeEach(schemaIds, (schemaId, d) => {
                        const schemaAdds = addsMap.get(schemaId);
                        const schemaResult = resolvedChanges.result.get(schemaId);

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
                                            schemaResult.adds.entities.push(doc.ok as any);
                                        }
                                    }
                                }

                                d(Result.success());
                            });
                        });

                    });

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

    private _defaultBulkOperations<T extends {}>(schemaIds: SchemaId[], resolvedChanges: ResolvedChanges<T>, done: CallbackResult<never>): void {

        const { data: updates } = resolvedChanges.changes.updates(schemaIds);
        const { data: removes } = resolvedChanges.changes.removes(schemaIds);
        const { data: adds } = resolvedChanges.changes.adds(schemaIds);

        if (updates.length === 0 && removes.length === 0 && adds.length === 0) {
            done(Result.success())
            return;
        }

        this._doWork((db, d) => {
            try {

                db.bulkDocs([
                    ...adds.map(x => x[1]),
                    ...removes.map(w => ({ _id: (w[1] as any)._id, _rev: (w[1] as any)._rev, _deleted: true })),
                    ...updates.map(x => x[1].entity)
                ], null, (error, response) => {

                    if (error != null) {
                        d(Result.error(error));
                        return;
                    }
                    debugger;
                    for (let i = 0, length = response.length; i < length; i++) {
                        const doc = response[i];

                        if ("error" in doc) {

                            const reason = doc.reason ?? doc.error;

                            d(Result.error(reason));
                            return;
                        }

                        const removesIndex = removes.findIndex(x => (x[1] as PouchDbDoc<InferType<T>>)._id === doc.id);

                        if (removesIndex !== -1) {
                            const [schemaId] = removes[removesIndex]
                            const schemaResult = resolvedChanges.result.get(schemaId);

                            assertIsNotNull(schemaResult);

                            schemaResult.removes.entities.push(doc as any);
                            continue;
                        }

                        const updatesIndex = updates.findIndex(x => (x[1].entity as PouchDbDoc<InferType<T>>)._id === doc.id);

                        if (updatesIndex !== -1) {
                            const [schemaId] = updates[updatesIndex];
                            const schemaResult = resolvedChanges.result.get(schemaId);

                            assertIsNotNull(schemaResult);

                            schemaResult.updates.entities.push(doc as any);
                            continue;
                        }

                        const addsIndex = adds.findIndex(x => (x[1] as PouchDbDoc<InferType<T>>)._id === doc.id);

                        if (addsIndex !== -1) {
                            const [schemaId] = adds[addsIndex];
                            const schemaResult = resolvedChanges.result.get(schemaId);

                            assertIsNotNull(schemaResult);

                            schemaResult.adds.entities.push(doc as any);
                            continue;
                        }

                        d(Result.error(new Error("Cannot classify resulting doc")));
                        return;
                    }

                    d(Result.success());

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
            done(null);
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

    private _validateSchemas<TRoot extends {}>(event: DbPluginBulkPersistEvent<TRoot>) {
        for (const [, schema] of event.schemas) {
            if (schema.idProperties.length > 1) {
                throw new Error("PouchDB cannot have more than one key per document.  Only '_id' is allowed to be the key")
            }
        }
    }

    private _bulkPersist<TRoot extends {}>(
        event: DbPluginBulkPersistEvent<TRoot>,
        done: CallbackPartialResult<ResolvedChanges<TRoot>>) {

        this._validateSchemas(event);

        const resolvedChanges = event.operation.toResult();
        const identitySchemaIds: SchemaId[] = [];
        const defaultSchemaIds: SchemaId[] = [];

        for (const [schemaId, schema] of event.schemas) {

            if (schema.hasIdentityKeys) {
                identitySchemaIds.push(schemaId);
                continue;
            }

            defaultSchemaIds.push(schemaId);
        }

        this._identityBulkOperations<TRoot>(identitySchemaIds, resolvedChanges, (identityResult) => {

            if (identityResult.ok !== Result.SUCCESS) {
                done(Result.error(identityResult.error))
                return;
            }

            this._defaultBulkOperations<TRoot>(defaultSchemaIds, resolvedChanges, (defaultResult) => {

                if (defaultResult.ok !== Result.SUCCESS) {
                    done(Result.error(defaultResult.error))
                    return;
                }

                done(Result.success(resolvedChanges))
            });

        });
    }

    private _doWork<TResult, TEntity>(work: (db: PouchDB.Database<TEntity>, done: CallbackResult<TResult>) => void, done: CallbackResult<TResult>, shouldClose: boolean = false) {
        const db = new PouchDB<TEntity>(this._name, this._options);

        work(db, (result) => {

            if (shouldClose) {
                db.close(() => done(result));
            }

            done(result);
        })
    }

    destroy(done: (error?: any) => void): void {
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


    bulkPersist<TRoot extends {}>(
        event: DbPluginBulkPersistEvent<TRoot>,
        done: CallbackPartialResult<ResolvedChanges<TRoot>>) {

        const unitOfWork: SyncronousUnitOfWork = (d) => this._bulkPersist(event, (r) => {
            d();
            done(r)
        })

        queue.enqueue(unitOfWork.bind(this));
    }

    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: CallbackResult<TShape>): void {
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
        const jsonTranslator = new PouchDbTranslator<TEntity, TShape>(event.operation);
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

                const translated = jsonTranslator.translate(response.rows.map(w => w.doc));
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
        const jsonTranslator = new PouchDbTranslator<TEntity, TShape>(event.operation);
        this._doWork((w, d) => {
            w.allDocs({
                include_docs: true
            }).then(response => {
                const data = response.rows.map(w => w.doc);
                const translated = jsonTranslator.translate(data);
                d(Result.success(translated));
            }).catch(error => {
                d(Result.error(error));
            });
        }, done);
    }

    private _queryWithFilters<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>) {
        const jsonTranslator = new PouchDbTranslator<TEntity, TShape>(event.operation);
        this._doWork((w, d) => {
            w.query<{}, any>((doc, emit) => {
                if (typeof doc === "object" && "_id" in doc && jsonTranslator.matches(doc)) {
                    emit(doc._id, doc);
                }
            }, (error, response) => {

                if (error != null) {
                    d(Result.error(error));
                    return;
                }

                const data = response.rows.map(w => w.value);
                const translated = jsonTranslator.translate(data);
                d(Result.success(translated));
            });
        }, done);
    }

    private _query<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>): void {
        this.resolveIndexes(event, (r) => {

            if (r.ok !== Result.SUCCESS) {
                done(r)
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