import { EphemeralDataPlugin, DbPluginEvent } from "@routier/core/plugins";
import { PluginEventCallbackResult, PluginEventResult } from "@routier/core/results";
import { MemoryDataCollection } from "@routier/core/collections";
import { CompiledSchema } from "@routier/core/schema";

/**
 * A throwaway in-memory store, used to ask whether a set of changed entities matches a query.
 *
 * `DataBridge` needs to answer "did anything in this change notification match the filter the
 * caller is subscribed to?" without going back to the real backend. Seeding the changed
 * entities into an in-process store and running the same query against it answers that with
 * the query engine core already has — no second implementation of filter evaluation.
 *
 * ## Why this is not `MemoryPlugin`
 *
 * It used to be. `DataBridge` imported `@routier/memory-plugin`, which made the CRUD
 * abstraction depend on one specific backend — the one thing this package is not allowed to
 * do, and the reason `architecture/src/domains.ts` restricts what it may import.
 *
 * Nothing about the need was plugin-shaped. `EphemeralDataPlugin` and `MemoryDataCollection`
 * both live in core, so the datastore can build its own scratch store out of the model's own
 * pieces. `MemoryPlugin` adds a process-wide registry keyed by database name, which is
 * actively wrong here: this store must not be visible to anything else, and its lifetime is
 * one question.
 */
export class ChangeMatchProbe extends EphemeralDataPlugin {

    /**
     * Instance-scoped, unlike `MemoryPlugin`'s process-wide registry. Two probes never see
     * each other's rows, so a concurrent subscription cannot answer with another's changes.
     */
    private readonly collections = new Map<string, MemoryDataCollection>();

    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection {
        const existing = this.collections.get(schema.collectionName);

        if (existing != null) {
            return existing;
        }

        const created = new MemoryDataCollection(schema);
        this.collections.set(schema.collectionName, created);

        return created;
    }

    /** Loads entities straight into the collection, bypassing change tracking. */
    seed<TEntity extends {}>(schema: CompiledSchema<TEntity>, data: Record<string, unknown>[]): void {
        this.resolveCollection(schema).seed(data);
    }

    override destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.collections.clear();
        done(PluginEventResult.success(event.id));
    }
}
