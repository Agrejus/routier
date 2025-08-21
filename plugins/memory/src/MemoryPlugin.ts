import { MemoryDatabase } from ".";
import { DbPluginEvent, EphemeralDataPlugin } from "routier-core/plugins";
import { CompiledSchema } from "routier-core/schema";
import { CallbackResult, PluginEventCallbackResult, PluginEventResult, Result } from "routier-core/results";
import { MemoryDataCollection } from "routier-core/collections";

const dbs: Record<string, MemoryDatabase> = {};

export class MemoryPlugin extends EphemeralDataPlugin {

    constructor(databaseName?: string) {
        super(databaseName ?? "__routier-memory-plugin-db__");

        if (dbs[this.databaseName] == null) {
            dbs[this.databaseName] = {}
        }
    }

    get size() {
        let count = 0;

        for (const collectionName in this.database) {
            count += this.database[collectionName].size;
        }

        return count;
    }

    private get database() {
        return dbs[this.databaseName];
    }

    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {

        if (dbs[this.databaseName][schema.collectionName] == null) {
            dbs[this.databaseName][schema.collectionName] = new MemoryDataCollection(schema);
        }

        return dbs[this.databaseName][schema.collectionName];
    }

    getCollectionSize(collectionName: string) {

        if (!this.database[collectionName]) {
            return 0;
        }

        return this.database[collectionName].size;
    }

    seed<TEntity extends {}>(schema: CompiledSchema<TEntity>, data: Record<string, unknown>[]) {
        const collection = this.resolveCollection(schema);
        collection.seed(data);
    }

    override destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: PluginEventCallbackResult<never>): void {
        dbs[this.databaseName] = {};
        done(PluginEventResult.success(event.id));
    }
}