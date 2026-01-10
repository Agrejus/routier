import { ComposerDependencies, RequestContext } from "../../collections/types";
import { QueryBuilderBase } from '../base/QueryBuilderBase';

export type QueryBuilderContext<TRoot extends {}> = {
    request: RequestContext<TRoot>;
}

export abstract class QueryableBuilder<TRoot extends {}, TShape, U> extends QueryBuilderBase<TRoot, TShape, ComposerDependencies<TRoot>> {

    // Cannot change the root type, it comes from the collection type, only the resulting type (shape)
    protected create<Shape, TInstance extends QueryableBuilder<TRoot, Shape, U>>(
        Instance: new (dependencies: ComposerDependencies<TRoot>, request: RequestContext<TRoot>) => TInstance) {
        return new Instance(this.dependencies, this.request);
    }
}   