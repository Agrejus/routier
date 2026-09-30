import { stampEtag } from '@routier/core/collections';
import { CompiledSchema, IdType, InferType, PropertyInfo } from '@routier/core/schema';
import { UnknownRecord } from '@routier/core/utilities';

type DexieKey = IdType | IdType[];

type StoredRowReader = {
    bulkGet(keys: DexieKey[]): PromiseLike<(UnknownRecord | undefined)[]>;
};

export const dexieKey = (schema: CompiledSchema<UnknownRecord>, entity: InferType<UnknownRecord>): DexieKey => {
    const ids = schema.getIds(entity);
    return schema.idProperties.length === 1 ? ids[0] : ids;
};

export const stampAddedEtags = (etag: PropertyInfo<{}> | null, adds: UnknownRecord[]): void => {
    for (const add of adds) {
        stampEtag(etag, add, undefined);
    }
};

export const stampUpdatedEtags = async (table: StoredRowReader, etag: PropertyInfo<{}> | null, keys: DexieKey[], updates: UnknownRecord[]): Promise<void> => {
    if (etag == null) {
        return;
    }

    const priors = await table.bulkGet(keys);

    updates.forEach((update, index) => stampEtag(etag, update, priors[index]));
};
