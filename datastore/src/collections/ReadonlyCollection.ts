import { ChangeTrackingType } from '@routier/core';
import { CollectionBase } from './CollectionBase';

/**
 * Readonly collection that only allows data selection. Cannot add, remove, or update data.
 */
export class ReadonlyCollection<TEntity extends {}, TStore = unknown> extends CollectionBase<TEntity, TStore> {

    protected override get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }
}