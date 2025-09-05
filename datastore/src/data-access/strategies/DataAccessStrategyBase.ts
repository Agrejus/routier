import { BulkPersistResult } from "@routier/core/collections";
import { DbPluginBulkPersistEvent, IDbPlugin } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult } from "@routier/core/results";
import { CompiledSchema } from "@routier/core/schema";

export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;
    protected readonly schema: CompiledSchema<T>;

    constructor(dbPlugin: IDbPlugin, schema: CompiledSchema<T>) {
        this.dbPlugin = dbPlugin;
        this.schema = schema;
    }

    protected _bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        this.dbPlugin.bulkPersist(event, done);
    }
}