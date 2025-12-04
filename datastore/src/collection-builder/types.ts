import { CollectionBase } from "../collections/CollectionBase";
import { CollectionDependencies } from '../collections/types';

export type CollectionInstanceCreator<
    TEntity extends {},
    TCollection extends CollectionBase<TEntity>
> = new (
    container: CollectionDependencies<TEntity>
) => TCollection;