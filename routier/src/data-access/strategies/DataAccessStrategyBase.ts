import { ResolvedChanges } from "routier-core/collections";
import { DbPluginBulkPersistEvent, IDbPlugin } from "routier-core/plugins";
import { CallbackResult } from "routier-core/results";

export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;

    constructor(dbPlugin: IDbPlugin) {
        this.dbPlugin = dbPlugin;
    }

    protected _bulkPersist(event: DbPluginBulkPersistEvent<T>, done: CallbackResult<ResolvedChanges<T>>) {
        this.dbPlugin.bulkPersist(event, done);
    }
}