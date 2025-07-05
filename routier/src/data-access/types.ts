import { CallbackResult, DbPluginBulkOperationsEvent, DbPluginQueryEvent, EntityModificationResult } from "routier-core";
import { CollectionOptions } from "../types";

export interface IDataAccessStrategy<T extends {}> {
    bulkOperations(collectionOptions: CollectionOptions, event: DbPluginBulkOperationsEvent<T>, done: CallbackResult<EntityModificationResult<T>>): void;
    query<TShape>(collectionOptions: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>): void;
}