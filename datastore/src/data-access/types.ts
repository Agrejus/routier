import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import { CallbackResult, PluginEventCallbackPartialResult } from "@routier/core/results";
import { BulkPersistResult } from "@routier/core/collections";

export interface IDataAccessStrategy<T extends {}> {
    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void;
    query<TShape>(event: DbPluginQueryEvent<T, TShape>, done: CallbackResult<ITranslatedValue<TShape>>): void;
}