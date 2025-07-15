import { CallbackResult, DbPluginBulkPersistEvent, DbPluginQueryEvent, ResolvedChanges } from "routier-core";
import { CollectionOptions } from "../types";

export interface IDataAccessStrategy<T extends {}> {
    bulkPersist(collectionOptions: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: CallbackResult<ResolvedChanges<T>>): void;
    query<TShape>(collectionOptions: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>): void;
}