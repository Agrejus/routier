import { CallbackResult, DbPluginBulkOperationsEvent, EntityModificationResult, IDbPlugin } from "routier-core";

export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;

    constructor(dbPlugin: IDbPlugin) {
        this.dbPlugin = dbPlugin;
    }

    protected _bulkOperations(event: DbPluginBulkOperationsEvent<T>, done: CallbackResult<EntityModificationResult<T>>) {
        this.dbPlugin.bulkOperations(event, done);
    }
}