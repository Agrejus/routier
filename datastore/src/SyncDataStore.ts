import { IDbPlugin } from "@routier/core/plugins";
import { DataStore } from "./DataStore";
import { CompiledSchema, HashType, InferCreateType, InferType } from "@routier/core/schema";
import { Result, ResultType } from "@routier/core/results";
import { BulkPersistResult, SchemaPersistResult } from "@routier/core/collections";
import { logger, UnknownRecord } from "@routier/core/utilities";
import { assertIsNotNull } from "@routier/core/assertions";
import { Collection } from "./collections/Collection";

export abstract class SyncDataStore extends DataStore {

    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    async sync() {
        for (const [, schema] of this.schemas) {
            const result = await this.onRequestData(schema);
            await this.syncRemoteCollectionData(schema, result);
        }
    }

    private toMap<T extends {}>(schema: CompiledSchema<T>, data: T[]): Map<string, string> {
        const result = new Map<string, string>();

        for (let i = 0, length = data.length; i < length; i++) {
            const key = schema.hash(data[i] as InferType<T>, HashType.Ids);
            const value = schema.hash(data[i] as InferCreateType<T>, HashType.Object);
            result.set(key, value);
        }

        return result;
    }

    private toEntityMap<T extends {}>(schema: CompiledSchema<T>, data: T[]): Map<string, InferType<T>> {
        const result = new Map<string, InferType<T>>();

        for (let i = 0, length = data.length; i < length; i++) {
            const entity = data[i] as InferType<T>;
            const key = schema.hash(entity, HashType.Ids);
            result.set(key, entity);
        }

        return result;
    }

    private async syncRemoteCollectionData(schema: CompiledSchema<Record<string, unknown>>, result: Record<string, unknown>[]) {
        const collectionBase = this.collections.get(schema.id);

        assertIsNotNull(collectionBase, `Could not find collection for schemaId.  Collection Name: ${schema.collectionName}`);

        const collection = collectionBase as Collection<UnknownRecord>;

        const allDataResult = await collection.toArrayAsync();

        const hashedCollectionData = this.toMap(schema, allDataResult);
        const entityMap = this.toEntityMap(schema, allDataResult);
        const remoteEntityIdHashes = new Set<string>();
        const adds: InferCreateType<UnknownRecord>[] = [];
        const updates: Array<{ local: InferType<UnknownRecord>, remote: InferType<UnknownRecord> }> = [];

        for (let i = 0, length = result.length; i < length; i++) {
            const remoteEntity = result[i] as InferType<UnknownRecord>;
            const hashedEntityIds = schema.hash(remoteEntity, HashType.Ids);
            remoteEntityIdHashes.add(hashedEntityIds);

            const hashedLocalEntity = hashedCollectionData.get(hashedEntityIds);

            if (hashedLocalEntity == null) {
                adds.push(remoteEntity as InferCreateType<UnknownRecord>);
                continue;
            }

            const hashedRemoteEntity = schema.hash(remoteEntity, HashType.Object);

            if (hashedRemoteEntity !== hashedLocalEntity) {
                const localEntity = entityMap.get(hashedEntityIds);
                if (localEntity) {
                    updates.push({ local: localEntity, remote: remoteEntity });
                }
            }
        }

        const removals: InferType<UnknownRecord>[] = [];
        for (let i = 0, length = allDataResult.length; i < length; i++) {
            const localEntity = allDataResult[i] as InferType<UnknownRecord>;
            const hashedEntityIds = schema.hash(localEntity, HashType.Ids);

            if (!remoteEntityIdHashes.has(hashedEntityIds)) {
                removals.push(localEntity);
            }
        }

        await this.processBatches(collection, schema, adds, updates, removals);
    }

    private async processBatches(
        collection: Collection<UnknownRecord>,
        schema: CompiledSchema<Record<string, unknown>>,
        adds: InferCreateType<UnknownRecord>[],
        updates: Array<{ local: InferType<UnknownRecord>, remote: InferType<UnknownRecord> }>,
        removals: InferType<UnknownRecord>[]
    ) {
        const BATCH_SIZE = 100;
        let addIndex = 0;
        let updateIndex = 0;
        let removalIndex = 0;

        while (true) {
            let hasWork = false;

            if (addIndex < adds.length) {
                hasWork = true;
                const batch = adds.slice(addIndex, addIndex + BATCH_SIZE);
                addIndex += BATCH_SIZE;

                try {
                    await collection.addAsync(...batch);
                } catch (error) {
                    logger.error(`Error adding entities during sync.  Collection Name: ${schema.collectionName}`, error);
                }
            }

            if (updateIndex < updates.length) {
                hasWork = true;
                const endIndex = Math.min(updateIndex + BATCH_SIZE, updates.length);

                for (let i = updateIndex; i < endIndex; i++) {
                    const { local, remote } = updates[i];
                    schema.merge(local, remote);
                    collection.attachments.set(local);
                    collection.attachments.markDirty(local);
                }

                updateIndex = endIndex;
            }

            if (removalIndex < removals.length) {
                hasWork = true;
                const batch = removals.slice(removalIndex, removalIndex + BATCH_SIZE);
                removalIndex += BATCH_SIZE;

                try {
                    await collection.removeAsync(...batch);
                } catch (error) {
                    logger.error(`Error removing entities during sync.  Collection Name: ${schema.collectionName}`, error);
                }
            }

            if (!hasWork) {
                break;
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }

    abstract onRequestData<T extends {}>(schema: CompiledSchema<T>): Promise<T[]>
    abstract onSendData<T extends {}>(schema: CompiledSchema<T>, data: SchemaPersistResult<T>): void
    abstract onDestroyDataStore(): Promise<void>

    override async saveChanges(): Promise<BulkPersistResult> {
        const result = await super.saveChanges();

        try {
            for (const [schemaId, persistResult] of result) {
                if (persistResult.hasItems === false) {
                    continue;
                }

                const schema = this.schemas.get<UnknownRecord>(schemaId);

                assertIsNotNull(schema);

                this.onSendData(schema, persistResult);
            }

            return result;
        } catch (e) {
            throw e;
        }
    }

    override async destroy(): Promise<void> {
        await super.destroy();
        await this.onDestroyDataStore();
    }
}