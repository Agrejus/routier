import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { assertIsMemoryPlugin, MemoryPlugin } from "routier-plugin-memory";
import { CollectionOptions, StatefulCollectionOptions } from "../../types";
import { DbPluginBulkPersistEvent, DbPluginLogging, DbPluginQueryEvent, DbPluginReplicator, IDbPlugin, IDbPluginReplicator, OptimisticDbPluginReplicator, Query } from "routier-core/plugins";
import { CallbackResult, Result } from "routier-core/results";
import { CollectionChanges, PendingChanges, ResolvedChanges } from "routier-core/collections";
import { assertInstanceOfDbPluginLogging, assertIsNotNull } from "routier-core/assertions";
import { InferCreateType } from "routier-core/schema";

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

    bulkPersist(collectionOptions: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: CallbackResult<ResolvedChanges<T>>) {
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
                schemas: event.schemas
            }, (r) => {

                if (r.ok === Result.ERROR) {
                    done(r);
                    return;
                }

                const operation = new PendingChanges<T>();
                const changes = new CollectionChanges<T>({
                    adds: {
                        entities: r.data as InferCreateType<T>[]
                    }
                });

                // only send in one schema at a time since we are technically in the scope of the schema
                operation.changes.set(event.operation.schema.id, changes);

                // Add data to the read plugin
                readPlugin.bulkPersist({
                    operation,
                    schemas: event.schemas
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