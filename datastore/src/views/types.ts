import { InferCreateType, InferType } from '@routier/core/schema';
import { CollectionDependencies } from '../collections/types';
import { IDbPlugin } from '@routier/core/plugins';

export interface ViewDependencies<TRoot extends {}> extends CollectionDependencies<TRoot> {
    derive: Derive<TRoot>;
    persist: IDbPlugin["bulkPersist"];
}

export type DeriveResponse = (() => void) | (() => void)[];
export type DeriveCallback<TEntity extends {}> = (data: (InferType<TEntity> | InferCreateType<TEntity>)[]) => void;
export type Derive<TEntity extends {}> = (callback: DeriveCallback<TEntity>) => DeriveResponse;