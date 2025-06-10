import { EntityModificationResult, IDbPlugin } from "routier-core";
import { DbPluginBulkOperationsEvent } from "routier-core/dist/plugins/types";

export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;

    constructor(dbPlugin: IDbPlugin) {
        this.dbPlugin = dbPlugin;
    }

    protected _bulkOperations(event: DbPluginBulkOperationsEvent<T>, done: (result: EntityModificationResult<T>, error?: any) => void) {
        this.dbPlugin.bulkOperations(event, done);
    }
}