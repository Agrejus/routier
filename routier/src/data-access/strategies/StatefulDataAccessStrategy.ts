import { Query, assertIsNotNull, InferCreateType, DbPluginLogging, IDbPluginReplicator, OptimisticDbPluginReplicator, assertInstanceOfDbPluginLogging, IDbPlugin, DbPluginReplicator, CollectionChangesResult, DbPluginBulkPersistEvent, DbPluginQueryEvent, CallbackResult, Result, SchemaId } from "routier-core";
import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { assertIsMemoryPlugin, MemoryPlugin } from "routier-plugin-memory";
import { CollectionOptions, StatefulCollectionOptions } from "../../types";

let dbPluginReplicator: IDbPluginReplicator;

const getReplicator = (dbPlugin: IDbPlugin, optimistic?: boolean) => {
    if (dbPluginReplicator != null) {
        return dbPluginReplicator;
    }

    if (optimistic === true) {
        dbPluginReplicator = OptimisticDbPluginReplicator.create({
            replicas: [],
            source: dbPlugin,
            read: dbPlugin instanceof DbPluginLogging ? DbPluginLogging.create(new MemoryPlugin()) : new MemoryPlugin()
        });
    } else {
        dbPluginReplicator = DbPluginReplicator.create({
            replicas: [],
            source: dbPlugin,
            read: dbPlugin instanceof DbPluginLogging ? DbPluginLogging.create(new MemoryPlugin()) : new MemoryPlugin()
        });
    }

    return dbPluginReplicator;
}

export class StatefulDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    bulkPersist(collectionOptions: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: CallbackResult<Map<SchemaId, CollectionChangesResult<T>>>) {
        const optimistic = (collectionOptions as StatefulCollectionOptions).optimistic;
        getReplicator(this.dbPlugin, optimistic).bulkPersist(event, done);
    }

    query<TShape>(_: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>) {

        const replicator = getReplicator(this.dbPlugin);

        assertIsNotNull(replicator.plugins.read, "Read plugin cannot be null for stateful collections");

        let readPlugin: MemoryPlugin;
        if (replicator.plugins.read instanceof DbPluginLogging) {

            assertInstanceOfDbPluginLogging(replicator.plugins.read);

            assertIsMemoryPlugin(replicator.plugins.read.plugin);

            readPlugin = replicator.plugins.read.plugin;
        } else if (replicator.plugins.read instanceof MemoryPlugin) {
            readPlugin = replicator.plugins.read;
        } else {
            throw new Error("Invalid plugin for read plugin for StatefulCollection")
        }

        if (readPlugin.size === 0) {
            const queryAll = Query.EMPTY<T, TShape>(event.operation.schema);

            this.dbPlugin.query<T, TShape>({
                operation: queryAll,
                parent: event.parent,
                schema: event.schema
            }, (r) => {

                if (r.ok === Result.ERROR) {
                    done(r);
                    return;
                }

                // Add data to the read plugin
                readPlugin.bulkOperations({
                    operation: {
                        adds: {
                            entities: r.data as InferCreateType<T>[]
                        },
                        removes: {
                            entities: [],
                            queries: []
                        },
                        updates: {
                            changes: []
                        },
                        tags: null
                    },
                    parent: event.parent,
                    schema: event.schema
                }, (bulkOperationsResult) => {

                    if (bulkOperationsResult.ok === Result.ERROR) {
                        done(bulkOperationsResult);
                        return;
                    }

                    // query the replicator now
                    replicator.query(event, done);
                })
            });
            return;
        }

        return replicator.query(event, done);
    }
}