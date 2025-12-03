import { RemovableCollection } from './RemovableCollection';
import { ChangeTrackingType } from "@routier/core/schema";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { CollectionDependencies } from "./types";

export class ImmutableCollection<TEntity extends {}> extends RemovableCollection<TEntity> {

    constructor(
        container: SimpleContainer<CollectionDependencies<TEntity>>
    ) {
        super(container);

        this.mutate = this.mutate.bind(this);
    }

    mutate() {

    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }
}