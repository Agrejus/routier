import { EntityModificationResult, InferType, Query, assertIsNotNull, InferCreateType, DbPluginLogging, IDbPluginReplicator, OptimisticDbPluginReplicator, assertInstanceOfDbPluginLogging, IDbPlugin, DbPluginReplicator } from "routier-core";
import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { assertIsMemoryPlugin, MemoryPlugin } from "routier-plugin-memory";
import { CollectionOptions, StatefulCollectionOptions } from "../../types";
import { DbPluginBulkOperationsEvent, DbPluginQueryEvent } from "routier-core/dist/plugins/types";

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

    bulkOperations(collectionOptions: CollectionOptions, event: DbPluginBulkOperationsEvent<T>, done: (result: EntityModificationResult<T>, error?: any) => void) {
        const optimistic = (collectionOptions as StatefulCollectionOptions).optimistic;
        getReplicator(this.dbPlugin, optimistic).bulkOperations(event, done);
    }

    query<TShape>(_: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: (response: TShape, error?: any) => void) {

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
            const queryAll = Query.EMPTY<T, InferType<T>[]>();

            this.dbPlugin.query<T, InferType<T>[]>({
                operation: queryAll,
                parent: event.parent,
                schema: event.schema
            }, (r, e) => {

                if (e != null) {
                    done(null, e);
                    return;
                }

                // Add data to the read plugin
                readPlugin.bulkOperations({
                    operation: {
                        adds: {
                            entities: r as InferCreateType<T>[]
                        },
                        removes: {
                            entities: [],
                            expression: null
                        },
                        updates: {
                            entities: new Map()
                        },
                        tags: null
                    },
                    parent: event.parent,
                    schema: event.schema
                }, (_, bulkOperationsError) => {

                    if (bulkOperationsError != null) {
                        done(null, bulkOperationsError);
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