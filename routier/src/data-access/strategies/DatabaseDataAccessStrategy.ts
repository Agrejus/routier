import { CallbackResult, DbPluginBulkOperationsEvent, DbPluginQueryEvent, EntityModificationResult } from "routier-core";
import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { CollectionOptions } from "../../types";

export class DatabaseDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    bulkOperations(_: CollectionOptions, event: DbPluginBulkOperationsEvent<T>, done: CallbackResult<EntityModificationResult<T>>) {
        super._bulkOperations(event, done);
    }

    query<TShape>(_: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>) {
        this.dbPlugin.query<T, TShape>(event, done);
    }
}