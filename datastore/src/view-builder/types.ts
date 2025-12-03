import { View } from "../views/View";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { ViewDependencies } from "../views/types";

export type ViewInstanceCreator<
    TEntity extends {},
    TCollection extends View<TEntity>
> = new (
    container: SimpleContainer<ViewDependencies<TEntity>>
) => TCollection;