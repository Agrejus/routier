import { IDbPlugin } from "@routier/core/plugins";
import { DataStore } from "./DataStore";
import { CompiledSchema, HashType, InferCreateType, InferType } from "@routier/core/schema";
import { CallbackPartialResult, CallbackResult, Result, ResultType } from "@routier/core/results";
import { BulkPersistResult, SchemaPersistResult } from "@routier/core/collections";
import { logger, UnknownRecord } from "@routier/core/utilities";
import { assertIsNotNull } from "@routier/core/assertions";
import { Collection } from "./collections/Collection";

export abstract class SyncDataStore extends DataStore {

    constructor(plugin: IDbPlugin) {
        super(plugin);
    }

    sync() {
        for (const [, schema] of this.schemas) {
            this.onRequestData(schema, (result) => {
                this.syncRemoteCollectionData(schema, result);
            });
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

    private syncRemoteCollectionData(schema: CompiledSchema<Record<string, unknown>>, result: ResultType<Record<string, unknown>[]>) {
        if (result.ok === Result.ERROR) {
            return logger.error(`An error occurred syncing remote data for schema.  Collection Name: ${schema.collectionName}`, result.error);
        }

        const collectionBase = this.collections.get(schema.id);

        assertIsNotNull(collectionBase, `Could not find collection for schemaId.  Collection Name: ${schema.collectionName}`);

        const collection = collectionBase as Collection<UnknownRecord>;

        collection.toArray(allDataResult => {
            if (allDataResult.ok === Result.ERROR) {
                return logger.error(`An error occurred during syncing, could not fetch all data for collection.  Collection Name: ${schema.collectionName}`);
            }

            const hashedCollectionData = this.toMap(schema, allDataResult.data);
            const entityMap = this.toEntityMap(schema, allDataResult.data);
            const remoteEntityIdHashes = new Set<string>();
            const adds: InferCreateType<UnknownRecord>[] = [];
            const updates: Array<{ local: InferType<UnknownRecord>, remote: InferType<UnknownRecord> }> = [];

            for (let i = 0, length = result.data.length; i < length; i++) {
                const remoteEntity = result.data[i] as InferType<UnknownRecord>;
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
            for (let i = 0, length = allDataResult.data.length; i < length; i++) {
                const localEntity = allDataResult.data[i] as InferType<UnknownRecord>;
                const hashedEntityIds = schema.hash(localEntity, HashType.Ids);

                if (!remoteEntityIdHashes.has(hashedEntityIds)) {
                    removals.push(localEntity);
                }
            }

            this.processBatches(collection, schema, adds, updates, removals);
        });
    }

    private processBatches(
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

        const processNextBatch = () => {
            let hasWork = false;

            if (addIndex < adds.length) {
                hasWork = true;
                const batch = adds.slice(addIndex, addIndex + BATCH_SIZE);
                addIndex += BATCH_SIZE;

                collection.add(batch, (addResult) => {
                    if (addResult.ok === Result.ERROR) {
                        logger.error(`Error adding entities during sync.  Collection Name: ${schema.collectionName}`, addResult.error);
                    }
                });
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

                collection.remove(batch, (removeResult) => {
                    if (removeResult.ok === Result.ERROR) {
                        logger.error(`Error removing entities during sync.  Collection Name: ${schema.collectionName}`, removeResult.error);
                    }
                });
            }

            if (hasWork) {
                setTimeout(processNextBatch, 5);
            }
        };

        processNextBatch();
    }

    abstract onRequestData<T extends {}>(schema: CompiledSchema<T>, done: CallbackResult<T[]>): void
    abstract onSendData<T extends {}>(schema: CompiledSchema<T>, data: SchemaPersistResult<T>): void
    abstract onDestroyDataStore(done: CallbackResult<never>): void

    override saveChanges(done: CallbackPartialResult<BulkPersistResult>): void {
        super.saveChanges(result => {

            if (result.ok === Result.ERROR) {
                return done(result);
            }

            try {
                for (const [schemaId, persistResult] of result.data) {
                    if (persistResult.hasItems === false) {
                        continue;
                    }

                    const schema = this.schemas.get<UnknownRecord>(schemaId);

                    assertIsNotNull(schema);

                    this.onSendData(schema, persistResult);
                }

                done(result);
            } catch (e) {
                done(Result.error(e));
            }
        });
    }

    override destroy(done: CallbackResult<never>): void {
        super.destroy(result => {
            if (result.ok === Result.ERROR) {
                return done(result);
            }

            this.onDestroyDataStore(remoteResult => {
                done(remoteResult);
            });
        });
    }
}