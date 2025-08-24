import { DbPluginBulkPersistEvent, DbPluginQueryEvent } from "routier-core/plugins";
import { CollectionOptions } from "../types";
import { CallbackResult, PluginEventCallbackPartialResult } from "routier-core/results";
import { BulkPersistResult } from "routier-core/collections";

export interface IDataAccessStrategy<T extends {}> {
    bulkPersist(collectionOptions: CollectionOptions, event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void;
    query<TShape>(collectionOptions: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>): void;
}