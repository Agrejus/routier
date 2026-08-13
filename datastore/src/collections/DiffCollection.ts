import { Collection } from './Collection';
import { ChangeTrackingType } from "@routier/core/schema";
import { CollectionDependencies } from "./types";

export class DiffCollection<TEntity extends {}, TStore = unknown> extends Collection<TEntity, TStore> {

    constructor(
        dependencies: CollectionDependencies<TEntity>
    ) {
        super(dependencies);
    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "diff";
    }
}