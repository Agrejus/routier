import { CallbackResult, DbPluginBulkPersistEvent, DbPluginQueryEvent, SchemaId } from "routier-core";
import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { CollectionOptions } from "../../types";
import { CollectionChangesResult } from "routier-core/dist/plugins/types";

export class DatabaseDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    bulkPersist(_: CollectionOptions, event: DbPluginBulkPersistEvent<T>, done: CallbackResult<Map<SchemaId, CollectionChangesResult<T>>>) {
        super._bulkPersist(event, done);
    }

    query<TShape>(_: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<TShape>) {
        this.dbPlugin.query<T, TShape>(event, done);
    }
}