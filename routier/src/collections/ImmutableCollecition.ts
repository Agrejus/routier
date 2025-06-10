import { InferType } from "routier-core";
import { Collection } from "./Collection";
import { ChangeTrackingType } from "routier-core/dist/schema";

export class ImmutableCollection<TEntity extends {}> extends Collection<TEntity> {

    protected get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }

    // We know changes are made if the attached entity is a proxy, means we altered it
    // Immutable sets deal with frozen objects
    mutate(entity: InferType<TEntity>, mutator: (draft: InferType<TEntity>) => void): InferType<TEntity> {

        const clone = this.schema.clone(entity);

        // enable change tracking
        const changeTrackedEntity = this.schema.enableChangeTracking(clone);

        mutator(changeTrackedEntity);

        // replace the entity with the change tracked entity
        this.changeTracker.replace(entity, changeTrackedEntity);

        // clone the change tracked entity to remove change tracking
        const untracked = this.schema.clone(changeTrackedEntity);

        return this.schema.freeze(untracked);
    }

}