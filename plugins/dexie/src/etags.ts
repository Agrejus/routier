import { stampEtag } from '@routier/core/plugins';
import { PropertyInfo } from '@routier/core/schema';
import { UnknownRecord } from '@routier/core/utilities';
import type { DexieKey } from './utils';

type StoredRowReader = {
    bulkGet(keys: DexieKey[]): PromiseLike<(UnknownRecord | undefined)[]>;
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
