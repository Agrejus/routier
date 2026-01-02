import { BulkPersistResult } from "@routier/core/collections";
import { DbPluginBulkPersistEvent, IDbPlugin } from "@routier/core/plugins";
import { CompiledSchema } from "@routier/core/schema";

export class DataAccessStrategyBase<T extends {}> {

    protected readonly dbPlugin: IDbPlugin;
    protected readonly schema: CompiledSchema<T>;

    constructor(dbPlugin: IDbPlugin, schema: CompiledSchema<T>) {
        this.dbPlugin = dbPlugin;
        this.schema = schema;
    }

    protected async _bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        return await this.dbPlugin.bulkPersist(event);
    }
}