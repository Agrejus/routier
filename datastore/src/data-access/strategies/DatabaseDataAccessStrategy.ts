import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import { BulkPersistResult } from "@routier/core/collections";

export class DatabaseDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    async bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        return await super._bulkPersist(event);
    }

    async query<TShape>(event: DbPluginQueryEvent<T, TShape>): Promise<ITranslatedValue<TShape>> {
        const result: ITranslatedValue<TShape> = await (this.dbPlugin as import("@routier/core/plugins").IDbPlugin).query<T, TShape>(event);
        return result;
    }
}