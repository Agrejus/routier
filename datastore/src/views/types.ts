import { InferCreateType, InferType } from '@routier/core/schema';

export type DeriveResponse = (() => void) | (() => void)[];
export type DeriveCallback<TEntity extends {}> = (data: (InferType<TEntity> | InferCreateType<TEntity>)[]) => void;
export type Derive<TEntity extends {}> = (callback: DeriveCallback<TEntity>) => DeriveResponse;