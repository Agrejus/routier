import { EntityModificationResult } from "routier-core";
import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { CollectionOptions } from "../../types";
import { DbPluginBulkOperationsEvent, DbPluginQueryEvent } from "routier-core/dist/plugins/types";

export class DatabaseDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    bulkOperations(_: CollectionOptions, event: DbPluginBulkOperationsEvent<T>, done: (result: EntityModificationResult<T>, error?: any) => void) {
        super._bulkOperations(event, done);
    }

    query<TShape>(_: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: (response: TShape, error?: any) => void) {
        this.dbPlugin.query<T, TShape>(event, done);
    }
}