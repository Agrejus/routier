import { CompiledSchema } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { MemoryDataCollection } from '@routier/core/collections';

export class BrowserStorageCollection extends MemoryDataCollection {

    private partition: string;
    private readonly storage: Storage;
    // The instance is shared per (database, collection) — see BrowserStoragePlugin's
    // registry — so the storage value is read exactly once and the in-memory view is
    // authoritative from then on. Re-reading on a later save would resurrect rows this
    // process removed after the value was written.
    private loadState: 'unloaded' | 'loaded' = 'unloaded';

    constructor(storage: Storage, partition: string, schema: CompiledSchema<any>) {
        super(schema);
        this.partition = partition;
        this.storage = storage;
    }

    private get databaseKey() {
        return `${this.partition}__${this.schema.collectionName}`;
    }

    private hydrate(records: Record<string, unknown>[]) {
        for (let i = 0, length = records.length; i < length; i++) {
            const record = records[i] as Record<string, unknown>;
            // Never clobber an in-memory record: save() hydrates AFTER adds have been
            // applied, and stored state must not win over pending mutations.
            this.addIfAbsent(record)
        }
    }

    override destroy(done: CallbackResult<never>) {
        try {

            this.storage.removeItem(this.databaseKey);

            // A destroyed collection may be reused (the registry entry outlives the
            // storage value), so the next load must re-read rather than trust the
            // emptied view.
            this.loadState = 'unloaded';

            super.destroy(done)
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    private _getData(): Record<string, unknown>[] {
        const stringifiedData = this.storage.getItem(this.databaseKey);

        if (stringifiedData == null) {
            return [];
        }

        // An empty value is an empty collection, not corruption — a key can be created
        // before anything is written to it.
        if (stringifiedData.trim().length === 0) {
            return [];
        }

        try {
            return JSON.parse(stringifiedData) as Record<string, unknown>[];
        } catch (parseError: any) {
            // Deliberately NOT recovered by resetting to an empty collection: that would
            // turn unreadable data into silently deleted data on the next save. The key is
            // named so the user can inspect or clear it themselves.
            throw new Error(
                `Cannot read collection '${this.schema.collectionName}': the value at storage key ` +
                `'${this.databaseKey}' is not valid JSON (${parseError?.message ?? parseError}). ` +
                `Nothing has been modified. Inspect the value and remove the key to start from empty — ` +
                `this plugin will not discard data it cannot parse.`,
                { cause: parseError }
            );
        }
    }

    override load(done: CallbackResult<never>) {
        if (this.loadState === 'loaded') {
            done(Result.success());
            return;
        }

        try {
            const data = this._getData();

            this.hydrate(data);

            // Success makes the in-memory view authoritative; an error leaves the
            // collection unloaded so the next attempt re-reads.
            this.loadState = 'loaded';

            done(Result.success());
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    override save(done: CallbackResult<never>) {

        // Add-only persists skip load() as an optimization, so the first save must merge
        // what is already in storage before writing — this.records alone would replace the
        // whole stored value with just the new adds, losing every previously persisted row.
        // Later saves see loadState === 'loaded' and the shared in-memory view is already
        // the whole collection. (Same trap as file-system, known-defects #18.)
        if (this.loadState !== 'loaded') {
            this.load(loadResult => {
                if (loadResult.ok === Result.ERROR) {
                    done(loadResult);
                    return;
                }

                this.save(done);
            });
            return;
        }

        try {
            // Compact, not pretty-printed: localStorage quota is per-origin and small
            // (~5MB), and indentation roughly doubles the bytes for no reader's benefit.
            this.storage.setItem(this.databaseKey, JSON.stringify(this.records));
            done(Result.success());
        } catch (e: any) {
            // Covers both a quota overflow from setItem and a value that cannot be
            // stringified (a cycle, a BigInt) — stringify is inside the try for that
            // reason, since throwing past the callback would strand the save.
            done(Result.error(e));
        }
    }
}
