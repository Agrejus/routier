import { View } from "../views/View";
import { CollectionDependencies } from "../collections/types";
import { Derive } from "../views/types";

export type ViewInstanceCreator<
    TEntity extends {},
    TCollection extends View<TEntity>
> = new (
    dependencies: CollectionDependencies<TEntity>,
    derive: Derive<TEntity>,
    /** Whether the view keeps rows the derivation no longer produces — see ViewBuilder.accumulate. */
    accumulates?: boolean
) => TCollection;