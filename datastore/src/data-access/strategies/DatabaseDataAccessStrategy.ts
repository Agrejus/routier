import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { CollectionOptions } from "../../types";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "@routier/core/results";
import { BulkPersistResult } from "@routier/core/collections";

export class DatabaseDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    bulkPersist(_: CollectionOptions, event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        super._bulkPersist(event, done);
    }

    query<TShape>(_: CollectionOptions, event: DbPluginQueryEvent<T, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>) {
        this.dbPlugin.query<T, TShape>(event, done);
    }
}