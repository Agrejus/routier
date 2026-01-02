import { assertIsNotNull } from '../assertions';
import { BulkPersistResult } from '../collections';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, JsonTranslator } from '.';
import { CompiledSchema, InferCreateType, InferType } from '../schema';
import { DeepPartial } from '../types';
import { MemoryDataCollection } from '../collections/MemoryDataCollection';
import { UnknownRecord } from '../utilities';

export abstract class EphemeralDataPlugin implements IDbPlugin {

    protected databaseName: string;

    constructor(databaseName: string) {
        this.databaseName = databaseName;
    }

    protected abstract resolveCollection<TEntity extends {}>(schema: CompiledSchema<TEntity>): MemoryDataCollection;

    async bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        const bulkPersistResult = event.operation.toResult();
        const schemas = event.schemas;

        for (const [schemaId, changes] of event.operation) {
            const { adds, hasItems, removes, updates } = changes;

            if (!hasItems) {
                continue;
            }

            const result = bulkPersistResult.get(schemaId);
            const schema = schemas.get(schemaId);
            assertIsNotNull(schema);

            const collection = this.resolveCollection(schema);
            await collection.load();

            const addsLength = adds.length;
            const updatesLength = updates.length;
            const removesLength = removes.length;
            result.adds = new Array(addsLength);
            result.updates = new Array(updatesLength);
            result.removes = new Array(removesLength);

            for (let j = 0; j < addsLength; j++) {
                const item = adds[j];
                collection.add(item);
                result.adds[j] = item as DeepPartial<InferCreateType<UnknownRecord>>;
            }

            for (let j = 0; j < updatesLength; j++) {
                const item = updates[j].entity;
                collection.update(item);
                result.updates[j] = item;
            }

            for (let j = 0; j < removesLength; j++) {
                collection.remove(removes[j]);
                result.removes[j] = removes[j];
            }

            await collection.save();
        }

        return bulkPersistResult;
    }

    async query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>): Promise<ITranslatedValue<TShape>> {
        const operation = event.operation;
        const schema = operation.schema;
        const translator = new JsonTranslator<TEntity, TShape>(operation);
        const collection = this.resolveCollection(schema);

        await collection.load();

        const records = collection.records;
        const length = records.length;
        const cloned: Record<string, unknown>[] = new Array(length);

        for (let i = 0; i < length; i++) {
            cloned[i] = schema.clone(records[i] as InferType<TEntity>);
        }

        return translator.translate(cloned);
    }

    abstract destroy(event: DbPluginEvent): Promise<void>;
}