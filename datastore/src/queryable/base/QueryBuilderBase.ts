import { QueryField, QueryOrdering } from "@routier/core/plugins";
import { GenericFunction } from "@routier/core/types";
import { Filter, ParamsFilter, toExpression } from "@routier/core/expressions";
import { SchemaTypes } from "@routier/core/schema";
import { ComposerDependencies, RequestContext } from "../../collections/types";

export abstract class QueryBuilderBase<TRoot extends {}, TShape, TDeps extends ComposerDependencies<TRoot>> {

    protected readonly request: RequestContext<TRoot>;
    protected readonly dependencies: TDeps;

    constructor(dependencies: TDeps, request: RequestContext<TRoot>) {
        this.dependencies = dependencies;
        this.request = request
    }

    protected getSortPropertyName(selector: GenericFunction<TShape, TShape[keyof TShape]>) {
        const stringified = selector.toString();

        const arrowIndex = stringified.indexOf("=>");
        if (arrowIndex < 0) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        const body = stringified.substring(arrowIndex + 2).trim();

        return this._extractPropertyName(body);
    }

    protected getFields<TRoot, R>(selector: GenericFunction<TRoot, R>): QueryField[] {

        const stringified = selector.toString();
        const arrowIndex = stringified.indexOf("=>");

        if (arrowIndex < 0) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        const body = stringified.substring(arrowIndex + 2).trim();


        if (body.includes("{")) {
            const propertyPaths = body.replace(/{|}|\(|\)/g, "").split(",").map(w => w.trim());
            return propertyPaths.map(propertyPath => {
                const [destinationName, sourcePathAndName] = propertyPath.split(":").map(w => w.trim());
                const sourceName = this._extractPropertyName(sourcePathAndName);
                const property = this.dependencies.schema.getProperty(sourceName);

                return {
                    sourceName,
                    destinationName,
                    isRename: sourceName === destinationName,
                    property
                } as QueryField;
            })
        }

        const field = this._extractPropertyName(body);
        const property = this.dependencies.schema.getProperty(field);

        return [{
            destinationName: field,
            sourceName: field,
            isRename: false,
            property
        } as QueryField];
    }

    private _extractPropertyName(value: string) {
        const split = value.split(".");

        split.shift();

        return split.join(".")
    }

    protected setFiltersQueryOption<P extends {}>(selector: ParamsFilter<TShape, P> | Filter<TShape>, params?: P) {

        const expression = toExpression(this.dependencies.schema, selector, params);

        this.request.queryOptions.add("filter", { filter: selector as Filter<TRoot> | ParamsFilter<TRoot, {}>, expression, params });
    }

    protected setMapQueryOption<K, R>(selector: GenericFunction<K, R>) {

        const fields = this.getFields(selector);

        this.request.queryOptions.add("map", { selector: selector as GenericFunction<any, any>, fields });
    }

    protected setGroupQueryOption<K, R>(selector: GenericFunction<K, R>) {

        const [key] = this.getFields(selector);
        let fields = this.dependencies.schema.properties.map(x => ({
            destinationName: x.name,
            getter: x.getValue,
            isRename: false,
            sourceName: x.name,
            property: x
        } as QueryField));
        const map = this.request.queryOptions.getLast("map");

        // If we remapped, grab those fields
        if (map != null) {
            fields = map.value.fields;
        }

        this.request.queryOptions.add("group", { selector: selector as GenericFunction<any, any>, key, fields });
    }

    protected setSortQueryOption(selector: GenericFunction<TShape, TShape[keyof TShape]>, direction: QueryOrdering) {
        const propertyName = this.getSortPropertyName(selector);

        // Resolve the PropertyInfo so execution targeting can detect unmapped or
        // renamed properties, which must sort in memory after deserialization
        const property = this.dependencies.schema.getProperty(propertyName);

        this.request.queryOptions.add("sort", { selector: selector as any, direction, propertyName, property });
    }

    /**
     * Records a similarity search, validating what can only be checked here.
     *
     * Both checks throw at the call rather than at execution. A width mismatch surfaces at
     * the backend as an error naming a column, several layers from the embedding that caused
     * it, and on a backend storing JSON it does not surface at all — every distance comes
     * back `Infinity` and the query returns an arbitrary ten rows that look like an answer.
     */
    protected setNearestQueryOption(selector: GenericFunction<TShape, TShape[keyof TShape]>, vector: number[], count: number) {
        const propertyName = this.getSortPropertyName(selector);
        const property = this.dependencies.schema.getProperty(propertyName);

        if (property != null && property.type !== SchemaTypes.Vector) {
            throw new Error(`.nearest() needs a vector property.  Property: ${propertyName}, Type: ${property.type}`);
        }

        if (property?.dimensions != null && property.dimensions !== vector.length) {
            throw new Error(`.nearest() was given a vector of the wrong width.  Property: ${propertyName}, Expected: ${property.dimensions}, Received: ${vector.length}`);
        }

        this.request.queryOptions.add("nearest", { selector: selector as any, propertyName, property, vector, count });
    }

    protected setSkipQueryOption(amount: number) {
        this.request.queryOptions.add("skip", amount);
    }

    protected setTakeQueryOption(amount: number) {
        this.request.queryOptions.add("take", amount);
    }
}   