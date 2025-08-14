import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { assertIsMemoryPlugin, MemoryPlugin } from "routier-plugin-memory";
import { CollectionOptions, StatefulCollectionOptions } from "../../types";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginLogging, DbPluginQueryEvent, DbPluginReplicator, IDbPlugin, IDbPluginReplicator, OptimisticDbPluginReplicator } from "routier-core/plugins";
import { CallbackResult } from "routier-core/results";
import { ResolvedChanges } from "routier-core/collections";
import { assertInstanceOfDbPluginLogging, assertIsNotNull } from "routier-core/assertions";
import { CompiledSchema, SchemaId } from "routier-core/schema";

let dbPluginReplicator: IDbPluginReplicator;

export class StatefulDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    private getMemoryCollectionName(event: DbPluginEvent<T>) {

        let collectionName = "";

        for (const [schemaId] of event.schemas) {
            collectionName += `${String(schemaId)}`;
        }

        return collectionName;
    }

    private getReplicator(dbPlugin: IDbPlugin, event: DbPluginEvent<T>, optimistic?: boolean) {
        if (dbPluginReplicator != null) {
            return dbPluginReplicator;
        }

        // We don't want plugin memory sets to stomp on each other
        const memoryCollectionName = this.getMemoryCollectionName(event);

        if (optimistic === true) {
            dbPluginReplicator = OptimisticDbPluginReplicator.create({
                replicas: [],
                source: dbPlugin,
                read: dbPlugin instanceof DbPluginLogging ? DbPluginLogging.create(new MemoryPlugin(memoryCollectionName)) : new MemoryPlugin(memoryCollectionName)
            }) as any;
        } else {
            dbPluginReplicator = DbPluginReplicator.create({
                replicas: [],
                source: dbPlugin,
                read: dbPlugin instanceof DbPluginLogging ? DbPluginLogging.create(new MemoryPlugin(memoryCollectionName)) : new MemoryPlugin(memoryCollectionName)
            });
        }

        return dbPluginReplicator;
    }

    private repackQueryEvent<TShape>(event: DbPluginQueryEvent<T, TShape>): DbPluginQueryEvent<T, TShape> {
        return {
            operation: event.operation,
            // Since we are only focused on the current collection, ensure that is the only one we are dealing with
            // Otherwise the memory collection will be incorrect and we will be saving more data than we need
            schemas: new Map<SchemaId, CompiledSchema<T>>([[event.operation.schema.id, event.operation.schema]])
        }
    }


    bulkPersist(collectionOptions: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: CallbackResult<ResolvedChanges<T>>) {
        const optimistic = (collectionOptions as StatefulCollectionOptions).optimistic;

        // all the replicator will do here is ensure we operated on the memory plugin first
        this.getReplicator(this.dbPlugin, event, optimistic).bulkPersist(event, done);
    }

    query<TShape>(collectionOptions: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>) {

        const optimistic = (collectionOptions as StatefulCollectionOptions).optimistic;

        const replicator = this.getReplicator(this.dbPlugin, event, optimistic);

        assertIsNotNull(replicator.plugins.read, "Read plugin cannot be null for stateful collections");

        let readPlugin: MemoryPlugin;
        if (replicator.plugins.read instanceof DbPluginLogging) {

            assertInstanceOfDbPluginLogging(replicator.plugins.read);

            assertIsMemoryPlugin(replicator.plugins.read.plugin);

            readPlugin = replicator.plugins.read.plugin;
        } else if (replicator.plugins.read instanceof MemoryPlugin) {
            readPlugin = replicator.plugins.read;

            assertIsMemoryPlugin(replicator.plugins.read);
        } else {
            throw new Error("Invalid read plugin for StatefulCollection")
        }

        // for stateful collections, we need to make sure we are only dealing with the targeted
        // collection, otherwise we will populate more data than necessary
        const repackedEvent = this.repackQueryEvent(event);

        return replicator.query(repackedEvent, done);
    }
}