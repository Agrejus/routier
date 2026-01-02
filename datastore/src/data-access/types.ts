import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import { BulkPersistResult } from "@routier/core/collections";

export interface IDataAccessStrategy<T extends {}> {
    bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult>;
    query<TShape>(event: DbPluginQueryEvent<T, TShape>): Promise<ITranslatedValue<TShape>>;
}