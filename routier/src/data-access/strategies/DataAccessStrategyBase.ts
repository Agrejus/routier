import { CallbackResult, DbPluginBulkPersistEvent, IDbPlugin, SchemaId, CollectionChangesResult } from "routier-core";
export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;

    constructor(dbPlugin: IDbPlugin) {
        this.dbPlugin = dbPlugin;
    }

    protected _bulkPersist(event: DbPluginBulkPersistEvent<T>, done: CallbackResult<Map<SchemaId, CollectionChangesResult<T>>>) {
        this.dbPlugin.bulkPersist(event, done);
    }
}