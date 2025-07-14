import { CallbackResult, DbPluginBulkPersistEvent, IDbPlugin, ResolvedChanges } from "routier-core";
export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;

    constructor(dbPlugin: IDbPlugin) {
        this.dbPlugin = dbPlugin;
    }

    protected _bulkPersist(event: DbPluginBulkPersistEvent<T>, done: CallbackResult<ResolvedChanges<T>>) {
        this.dbPlugin.bulkPersist(event, done);
    }
}