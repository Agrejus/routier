import PouchDB from 'pouchdb';
import { assertIsArray, assertIsNotNull, combineExpressions, ComparatorExpression, DbPluginBulkOperationsEvent, DbPluginEvent, DbPluginQueryEvent, EntityChanges, EntityModificationResult, Expression, getProperties, IDbPlugin, IdType, IQuery, PropertyInfo, QueryOptionsCollection, SyncronousQueue, SyncronousUnitOfWork, toMap, TrampolinePipeline } from 'routier-core';
import { PouchDbTranslator } from './PouchDbTranslator';

const queue = new SyncronousQueue();
const INDEX_NAME = "routier_pdb_indexes"
const cache: Record<string, unknown> = {};

type PouchDBPluginOptions = PouchDB.Configuration.DatabaseConfiguration & {
    queryType?: "default" | "memory-optimized" | "experimental"
}

type ForEachPayload<TEntity extends {}, TShape extends unknown = TEntity> = {
    event: DbPluginQueryEvent<TEntity>,
    results: TShape,
    error?: any
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

    private _identityBulkOperations<T extends {}>(event: DbPluginBulkOperationsEvent<T>, done: (result: { docs: T[], removesMap: Map<string, T>, updatesMap: Map<string, T> }, error?: any) => void): void {
        const errors: any[] = [];

        this._doWork((db, d) => {
            try {

                const { operation } = event;
                const { adds, removes, updates } = operation;

                this._getRemovalsByQueries(event, removes.queries, (r, e) => {

                    if (e != null) {
                        d(e)
                        return;
                    }

                    const removals = [...removes.entities, ...r];
                    const updatedDocuments = [...updates.entities].map(w => w[1].doc);
                    const removesMap = toMap(removals, w => (w as any)._id);
                    const updatesMap = toMap(updatedDocuments, w => (w as any)._id);


                    // the reponse is weird!
                    db.bulkDocs([...adds.entities, ...removals.map(w => ({ _id: (w as any)._id, _rev: (w as any)._rev, _deleted: true })), ...updatedDocuments], null, (error, response) => {

                        if (error) {
                            errors.push(error);
                        }

                        d({ docs: response?.map(w => w as T), updatesMap: updatesMap as any, removesMap: removesMap as any }, errors.length > 0 ? errors : null);
                    });
                })
            } catch (e) {
                d({ docs: [], updatesMap: new Map(), removesMap: new Map() }, [e, ...errors])
            }
        }, done);
    }

    private _getRemovalsByQueries<T extends {}>(event: DbPluginEvent<T>, queries: IQuery<T>[], done: (entities: { _id: IdType, _rev: string, _deleted: true }[], error?: any) => void) {

        if (queries.length === 0) {
            done([]); // Do nothing, handle null here for readability above
            return;
        }

        const pipeline = new TrampolinePipeline<ForEachPayload<T, { _id: IdType; _rev: string; _deleted: true; }[]>>();

        for (let i = 0, length = queries.length; i < length; i++) {
            const query = queries[i];
            const queryEvent: DbPluginQueryEvent<T> = {
                parent: event.parent,
                schema: event.schema,
                operation: query
            }

            pipeline.pipe((payload, done) => this._pipelineQuery({
                event: queryEvent,
                results: payload.results
            }, done));
        }

        pipeline.filter<{ _id: IdType; _rev: string; _deleted: true; }[]>({
            event: null,
            results: []
        }, (r, e) => {

            if (e) {
                done([], e);
                return;
            }

            done(r);
        })
    }

    private _defaultBulkOperations<T extends {}>(event: DbPluginBulkOperationsEvent<T>, done: (result: EntityModificationResult<T>, error?: any) => void): void {

        const result: EntityModificationResult<T> = {
            adds: [],
            removedCount: 0,
            updates: []
        }
        const errors: any[] = [];

        this._doWork((db, d) => {
            try {

                const { operation } = event
                const { adds, removes, updates } = operation;

                this._getRemovalsByQueries(event, removes.queries, (r, e) => {

                    if (e != null) {
                        d(e)
                        return;
                    }

                    const removals = [...removes.entities, ...r];
                    const updatedDocuments = [...updates.entities].map(w => w[1].doc);
                    const removesMap = toMap(removals, w => (w as any)._id);
                    const updatesMap = toMap(updatedDocuments, w => (w as any)._id);

                    db.bulkDocs([...adds.entities, ...removals.map(w => ({ _id: (w as any)._id, _rev: (w as any)._rev, _deleted: true })), ...updatedDocuments], null, (error, response) => {

                        if (error != null) {
                            errors.push(error)
                        }

                        response.forEach(item => {
                            if ("error" in item) {

                                const reason = item.reason ?? item.error;

                                if (reason) {
                                    errors.push(reason.toString())
                                }
                                return;
                            }

                            if (removesMap.has(item.id)) {
                                result.removedCount += 1;
                                return;
                            }

                            if (updatesMap.has(item.id)) {
                                result.updates.push({
                                    _id: item.id,
                                    _rev: item.rev
                                } as any);
                                return;
                            }

                            result.adds.push({
                                _id: item.id,
                                _rev: item.rev
                            } as any);
                        })

                        d(result, errors.length > 0 ? errors : null)

                    });
                });
            } catch (e) {
                d(result, [e, ...errors])
            }
        }, done);
    }

    private _prepareProperties(properties: PropertyInfo<any>[]) {

        properties.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        const paths = properties.map(w => w.getAssignmentPath({ parent: "doc" }));
        const viewName = `by_${paths.join("_")}`;

        return {
            properties,
            paths,
            viewName
        }
    }

    private resolveIndexes<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity>, done: (ddoc: PouchDbDesignDoc | null, error?: any) => void) {

        const indexes = event.schema.getIndexes();

        if (indexes.length === 0) {
            done(null);
            return;
        }

        if (cache["indexes"]) {
            done(cache["indexes"] as PouchDbDesignDoc);
            return; // Already built
        }

        const ddoc: PouchDbDesignDoc = {
            _id: `_design/${INDEX_NAME}`,
            views: {}
        }

        for (let i = 0, length = indexes.length; i < length; i++) {
            const index = indexes[i];
            const { viewName, paths } = this._prepareProperties(index.properties);

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
                            d(null, e);
                            return;
                        }

                        cache["indexes"] = ddoc;

                        d(ddoc);
                    });
                    return;
                }

                const matchingIndex = response.rows.find(x => x.id === `_design/${INDEX_NAME}`);

                // make sure we have the correct index created
                if (matchingIndex == null) {
                    db.put(ddoc as any, {}, (e) => {
                        if (e) {
                            d(null, e);
                            return;
                        }

                        cache["indexes"] = ddoc;

                        d(ddoc);
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
                            d(null, e);
                            return;
                        }

                        (result as any).views = ddoc.views

                        db.put(result as any, {}, (e) => {

                            if (e) {
                                d(null, e);
                                return;
                            }

                            cache["indexes"] = ddoc;

                            d(ddoc);
                        });
                    })
                    return;
                }

                d(ddoc);
            }).catch(e => {
                d(null, e);
            });
        }, done)
    }

    // id should be a string here because this is only run on identity inserts
    private _bulkGetAdditions<TEntity extends {}>(ids: string[], done: (response: PouchDB.Core.BulkGetResponse<TEntity>, error?: any) => void) {

        if (ids.length === 0) {
            done({ results: [] });
            return;
        }

        this._doWork((db, d) => {
            db.bulkGet<TEntity>({
                docs: ids.map(w => ({ id: w as string }))
            }, (error, response) => {

                if (error) {
                    d({ results: [] }, error);
                    return
                }

                d(response);
            });
        }, done);
    }

    private _bulkOperations<TEntity extends {}>(
        event: DbPluginBulkOperationsEvent<TEntity>,
        done: (result: EntityModificationResult<TEntity>, error?: any) => void) {

        if (event.schema.idProperties.length > 1) {
            throw new Error("PouchDB cannot have more than one key per document.  Only '_id' is allowed to be the key")
        }

        if (event.schema.hasIdentityKeys === true) {
            this._identityBulkOperations<TEntity>(event, (r, e) => {

                if (e) {
                    done(null, e);
                    return;
                }

                const ids: string[] = [];
                const result: EntityModificationResult<TEntity> = {
                    adds: [],
                    removedCount: 0,
                    updates: []
                }
                const errors: any[] = [];

                if (e) {
                    errors.push(e);
                    done(null, errors);
                    return;
                }

                for (let i = 0, length = r.docs.length; i < length; i++) {
                    const doc = r.docs[i];

                    if ("id" in doc && "ok" in doc) {
                        if (r.updatesMap.has(doc.id as string)) {
                            // Optimistically assume that the update worked as expected
                            const update = r.updatesMap.get(doc.id as string);

                            // Update the new rev
                            (update as any)._rev = (doc as any).rev;

                            result.updates.push(update as any);
                            continue;
                        }

                        if (r.removesMap.has(doc.id as string)) {
                            result.removedCount += 1;
                            continue;
                        }

                        ids.push(doc.id as string);
                    }
                }

                this._bulkGetAdditions(ids, (bulkGetResponse, error) => {

                    if (error) {
                        done(result, error);
                        return;
                    }

                    for (let i = 0, length = bulkGetResponse.results.length; i < length; i++) {
                        const docs = bulkGetResponse.results[i].docs;

                        if (docs.length === 1) {
                            const doc = docs[0];

                            if ("ok" in doc) {
                                result.adds.push(doc.ok as any);
                            }
                        }
                    }

                    done(result);
                });
            });
            return;
        }

        this._defaultBulkOperations<TEntity>(event, done);
    }

    private _doWork<TResult, TEntity>(work: (db: PouchDB.Database<TEntity>, done: (result: TResult, error?: any) => void) => void, done: (result: TResult, error?: any) => void, shouldClose: boolean = false) {
        const db = new PouchDB<TEntity>(this._name, this._options);

        work(db, (result, error) => {

            if (shouldClose) {
                db.close(() => done(result, error));
            }

            done(result, error);
        })
    }

    destroy(done: (error?: any) => void): void {
        // this needs to be queued too
        this._doWork((w, d) => {
            w.destroy(null, d);
        }, done, false);
    }


    bulkOperations<TEntity extends {}>(
        event: DbPluginBulkOperationsEvent<TEntity>,
        done: (result: EntityModificationResult<TEntity>, error?: any) => void) {

        const unitOfWork: SyncronousUnitOfWork = (d) => this._bulkOperations(event, (r, e) => {
            d();
            done(r, e)
        })

        queue.enqueue(unitOfWork.bind(this));
    }

    query<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity>, done: (result: TShape, error?: any) => void): void {
        const unitOfWork: SyncronousUnitOfWork = (d) => this._query<TEntity, TShape>(event, (r, e) => {
            d();
            done(r, e)
        })

        queue.enqueue(unitOfWork.bind(this));
    }

    protected onGetIndex<TEntity extends {}, TShape extends unknown = TEntity>(_: IQuery<TEntity>, __: PouchDB.Find.FindRequest<unknown>, done: (result: null | string | [string, string]) => void) {
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

        const { viewName } = this._prepareProperties(queryProperties);

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

    private _queryIndex<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity>, matchingIndex: MatchingIndex, done: (result: TShape, error?: any) => void) {
        const jsonTranslator = new PouchDbTranslator<TEntity, TShape>(event.operation, event.schema);
        this._doWork((w, d) => {

            const values = matchingIndex.properties.map(x => x.value)
            w.query(`${INDEX_NAME}/${matchingIndex.viewName}`, {
                key: values.length === 1 ? values[0] : values,
                include_docs: true,
            }, (error, response) => {

                if (error != null) {
                    d(null, error);
                    return;
                }

                const translated = jsonTranslator.translate(response.rows.map(w => w.doc));
                d(translated);
            });
        }, done);
    }

    private _queryNoIndex<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity>, done: (result: TShape, error?: any) => void) {
        const jsonTranslator = new PouchDbTranslator<TEntity, TShape>(event.operation, event.schema);
        this._doWork((w, d) => {
            w.query<{}, any>((doc, emit) => {
                if (typeof doc === "object" && "_id" in doc && jsonTranslator.matches(doc)) {
                    emit(doc._id, doc);
                }
            }, (error, response) => {

                if (error != null) {
                    d(null, error);
                    return;
                }

                const data = response.rows.map(w => w.value);
                const translated = jsonTranslator.translate(data);
                d(translated);
            });
        }, done);
    }

    private _query<TEntity extends {}, TShape extends unknown = TEntity>(event: DbPluginQueryEvent<TEntity>, done: (result: TShape, error?: any) => void): void {
        this.resolveIndexes(event, (ddoc, e) => {

            if (e) {
                done(null, e);
                return;
            }

            const expression = this._getExpression(event);

            if (ddoc == null || Expression.isEmpty(expression)) {
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

    private _getExpression<TEntity extends {}>(event: DbPluginQueryEvent<TEntity>) {
        const filters = event.operation.options.get("filter");

        const databaseFilters = filters.filter(x => x.option.target === "database");

        if (databaseFilters.length === 0) {
            return Expression.EMPTY;
        }

        const expressions = databaseFilters.map(x => x.option.value.expression);

        return combineExpressions(...expressions);
    }

    private _pipelineQuery<TEntity extends {}, TShape extends unknown = TEntity>(payload: ForEachPayload<TEntity, TShape>, done: (results: TShape, error?: any) => void): void {

        const { event, results } = payload;
        this._query(event, (result, error) => {

            if (error) {
                // any error will terminate the pipeline
                done(results, error);
                return;
            }

            assertIsArray(result);
            assertIsArray(results);

            results.push(...result);

            done(results);
        })
    }
}