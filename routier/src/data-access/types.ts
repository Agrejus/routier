import { DbPluginBulkPersistEvent, DbPluginQueryEvent } from "routier-core/plugins";
import { CollectionOptions } from "../types";
import { CallbackResult, PluginEventCallbackPartialResult } from "routier-core/results";
import { ResolvedChanges } from "routier-core/collections";

export interface IDataAccessStrategy<T extends {}> {
    bulkPersist(collectionOptions: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: PluginEventCallbackPartialResult<ResolvedChanges<T>>): void;
    query<TShape>(collectionOptions: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>): void;
}