import { EntityModificationResult } from "routier-core";
import { CollectionOptions } from "../types";
import { DbPluginBulkOperationsEvent, DbPluginQueryEvent } from "routier-core/dist/plugins/types";

export type FetchOptions = { mergeResponse?: boolean }

export interface IDataAccessStrategy<T extends {}> {
    bulkOperations(collectionOptions: CollectionOptions, event: DbPluginBulkOperationsEvent<T>, done: (result: EntityModificationResult<T>, error?: any) => void): void;
    query<TShape>(collectionOptions: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: (response: TShape, error?: any) => void): void;
}