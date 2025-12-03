import { CollectionBase } from "../collections/CollectionBase";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { CollectionDependencies } from '../collections/types';

export type CollectionInstanceCreator<
    TEntity extends {},
    TCollection extends CollectionBase<TEntity>
> = new (
    container: SimpleContainer<CollectionDependencies<TEntity>>
) => TCollection;