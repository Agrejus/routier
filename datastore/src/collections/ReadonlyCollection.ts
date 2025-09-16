import { ChangeTrackingType } from '@routier/core';
import { CollectionBase } from './CollectionBase';

/**
 * Readonly collection that only allows data selection. Cannot add, remove, or update data.
 */
export class ReadonlyCollection<TEntity extends {}> extends CollectionBase<TEntity> {

    protected override get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }
}