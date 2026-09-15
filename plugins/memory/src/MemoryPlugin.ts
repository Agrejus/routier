import { MemoryDatabase } from ".";
import { DbPluginEvent, EphemeralDataPlugin } from "@routier/core/plugins";
import { CompiledSchema } from "@routier/core/schema";
import { PluginEventCallbackResult, PluginEventResult } from "@routier/core/results";
import { MemoryDataCollection } from "@routier/core/collections";

const dbs: Record<string, MemoryDatabase> = {};

export class MemoryPlugin extends EphemeralDataPlugin {

    /**
     * @param databaseName Name of the in-process database to connect to. The name addresses a
     * database shared by every instance in this process that uses it (see `destroy`); it is not
     * an instance label. Omitted, it defaults to `"__routier-memory-plugin-db__"`, which every
     * unnamed instance shares.
     */
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

    /**
     * Clears the named database — for EVERY plugin instance using that name, not just this one.
     *
     * The registry is keyed by database name and shared process-wide, which is what makes two
     * `MemoryPlugin("app")` instances behave like two connections to one database. The other
     * side of that: destroy is not scoped to the instance it is called on. A test that
     * destroys its store empties the database out from under every other store that named it.
     *
     * Give each test its own database name if they run in one process.
     */
    override destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        dbs[this.databaseName] = {};
        done(PluginEventResult.success(event.id));
    }
}