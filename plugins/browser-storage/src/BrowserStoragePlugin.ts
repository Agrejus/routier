import { DbPluginEvent, EphemeralDataPlugin } from '@routier/core/plugins';
import { PluginEventCallbackResult, PluginEventResult, Result } from '@routier/core/results';
import { CompiledSchema } from '@routier/core/schema';
import { BrowserStorageCollection } from './BrowserStorageCollection';
import { WorkPipeline } from '@routier/core';

/**
 * One collection instance per (database name, collection name), process-wide — the same
 * registry FileSystemPlugin and MemoryPlugin keep.
 *
 * A save serializes the whole collection over one storage value, so the registry is what
 * makes repeated saves converge. With a per-operation collection instance every save gets
 * its own view of the "read" step: a fresh instance starts empty, and an add-only batch —
 * which `EphemeralDataPlugin` never hydrates, because only updates and removes need the
 * stored state — then writes that empty-plus-one view over everything already persisted.
 * With one shared instance per key, every writer mutates the same map and stringifies it
 * after its own mutation, so a later write is a superset of every earlier one.
 *
 * The boundary this creates: a browser-storage database belongs to ONE page/tab. After the
 * first read the in-memory view is authoritative and storage is write-only, so rows written
 * by another tab are never observed and the last tab to save wins the key. Concurrent
 * writers across tabs are unsupported — see the plugin README.
 *
 * Keyed by the Storage OBJECT first, not by database name alone: `localStorage` and
 * `sessionStorage` are different backing stores, and a database name is only unique within
 * one of them. A WeakMap so a discarded Storage does not pin its collections.
 */
const databases = new WeakMap<Storage, Record<string, BrowserStorageCollection>>();

export class BrowserStoragePlugin extends EphemeralDataPlugin {

    private readonly storage: Storage;

    constructor(databaseName: string, storage: Storage) {
        super(databaseName);
        this.storage = storage;
    }

    protected override resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        let collections = databases.get(this.storage);

        if (collections == null) {
            collections = {};
            databases.set(this.storage, collections);
        }

        const key = `${this.databaseName}__${schema.collectionName}`;

        if (collections[key] == null) {
            collections[key] = new BrowserStorageCollection(this.storage, this.databaseName, schema);
        }

        return collections[key];
    }

    override destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        try {
            const pipeline = new WorkPipeline();

            // Destroy goes through the REGISTERED instance, which empties itself and
            // returns to 'unloaded'. That is why no registry eviction is needed here: the
            // shared view is cleared in place, so a later store over the same key re-reads
            // the (now removed) storage value rather than resurrecting destroyed rows.
            for (const [, schema] of event.schemas) {
                const collection = this.resolveCollection(schema);
                pipeline.pipe((done) => collection.destroy(done))
            }

            pipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                done(PluginEventResult.success(event.id));
            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }
}