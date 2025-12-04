import { RemovableCollection } from './RemovableCollection';
import { ChangeTrackingType } from "@routier/core/schema";
import { CollectionDependencies } from "./types";

export class ImmutableCollection<TEntity extends {}> extends RemovableCollection<TEntity> {

    constructor(
        dependencies: CollectionDependencies<TEntity>
    ) {
        super(dependencies);

        this.mutate = this.mutate.bind(this);
    }

    mutate() {

    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }
}