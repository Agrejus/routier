import { Collection } from './Collection';
import { ChangeTrackingType } from "@routier/core/schema";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { CollectionDependencies } from "./types";

export class DiffCollection<TEntity extends {}> extends Collection<TEntity> {

    constructor(
        container: SimpleContainer<CollectionDependencies<TEntity>>
    ) {
        super(container);
    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "diff";
    }
}