import { CompiledSchema } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { MemoryDataCollection } from '@routier/core/collections';

export class BrowserStorageCollection extends MemoryDataCollection {

    private partition: string;
    private readonly storage: Storage;

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
            this.add(record)
        }
    }

    override destroy(done: CallbackResult<never>) {
        try {

            this.storage.removeItem(this.databaseKey);

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

        return JSON.parse(stringifiedData) as Record<string, unknown>[];;
    }

    override load(done: CallbackResult<never>) {
        try {
            const data = this._getData();

            this.hydrate(data);

            done(Result.success());
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    override save(done: CallbackResult<never>) {
        const stringifiedData = JSON.stringify(this.records, null, 2);

        try {
            this.storage.setItem(this.databaseKey, stringifiedData);
            done(Result.success());
        } catch (e: any) {
            done(Result.error(e));
        }
    }
}