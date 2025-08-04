import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { CollectionOptions } from "../../types";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent } from "routier-core/plugins";
import { CallbackResult } from "routier-core/results";
import { ResolvedChanges } from "routier-core/collections";

export class DatabaseDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    bulkPersist(_: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: CallbackResult<ResolvedChanges<T>>) {
        super._bulkPersist(event, done);
    }

    query<TShape>(_: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>) {
        this.dbPlugin.query<T, TShape>(event, done);
    }
}