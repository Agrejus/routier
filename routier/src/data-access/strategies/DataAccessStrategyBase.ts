import { CompiledSchema } from "routier-core";
import { ResolvedChanges } from "routier-core/collections";
import { DbPluginBulkPersistEvent, IDbPlugin } from "routier-core/plugins";
import { CallbackResult } from "routier-core/results";

export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;
    protected readonly schema: CompiledSchema<T>;

    constructor(dbPlugin: IDbPlugin, schema: CompiledSchema<T>) {
        this.dbPlugin = dbPlugin;
        this.schema = schema;
    }

    protected _bulkPersist(event: DbPluginBulkPersistEvent<T>, done: CallbackResult<ResolvedChanges<T>>) {
        this.dbPlugin.bulkPersist(event, done);
    }
}