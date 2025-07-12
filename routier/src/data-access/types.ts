import { CallbackResult, DbPluginBulkPersistEvent, DbPluginQueryEvent, SchemaId } from "routier-core";
import { CollectionOptions } from "../types";
import { CollectionChangesResult } from "routier-core/dist/plugins/types";

export interface IDataAccessStrategy<T extends {}> {
    bulkPersist(collectionOptions: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: CallbackResult<Map<SchemaId, CollectionChangesResult<T>>>): void;
    query<TShape>(collectionOptions: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>): void;
}