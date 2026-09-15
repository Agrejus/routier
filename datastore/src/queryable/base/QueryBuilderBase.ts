import { QueryField, QueryOrdering } from "@routier/core/plugins";
import { GenericFunction } from "@routier/core/types";
import { Filter, ParamsFilter, parseSelector, SelectedValue, toExpression } from "@routier/core/expressions";
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
        const body = this._bodyOf(selector);

        if (body == null) {
            throw new Error("Only arrow functions allowed in .map()")
        }

        return this._extractPropertyName(body);
    }

    /**
     * What a sort or `nearest` selector reads, and the name it is recorded under.
     *
     * Parsed with the filter grammar, so `r => r.dueDate.getTime()` names `dueDate` and says its value is
     * computed from it. A property is recorded under its declared path; a computed value keeps the name
     * its source text gives, which is what a cache key or `.explain()` tells apart.
     *
     * A selector the grammar cannot read, such as a closure, keeps the name and property its source text
     * gives, as before it was parsed, and is never direct. A plugin that orders by column hands it back,
     * and one that runs the caller's function runs it as it did.
     */
    private _readSortSelector(selector: GenericFunction<TShape, TShape[keyof TShape]>): Partial<SelectedValue> & { propertyName: string } {
        const parsed = parseSelector(this.dependencies.schema, selector);

        if (parsed.kind === "value") {
            const { property, reads, isDirectProperty } = parsed.value;

            return { propertyName: this._selectedName(selector, parsed.value), property, reads, isDirectProperty };
        }

        const propertyName = this.getSortPropertyName(selector);

        return { propertyName, property: this.dependencies.schema.getProperty(propertyName), isDirectProperty: false };
    }

    protected getFields<TRoot, R>(selector: GenericFunction<TRoot, R>): QueryField[] {
        const parsed = parseSelector(this.dependencies.schema, selector);

        if (parsed.kind === "value") {
            const name = this._selectedName(selector, parsed.value);

            return [this._toField(name, name, false, parsed.value)];
        }

        if (parsed.kind === "object") {
            return parsed.fields.map(field => {
                // A computed field has no path of its own, so it is named for the property it reads
                const sourceName = field.property?.id ?? field.name;

                return this._toField(sourceName, field.name, sourceName === field.name, field);
            });
        }

        return this._getFieldsFromSource(selector);
    }

    /** The fields a selector the grammar cannot read gives by its source text, as before it was parsed. Never direct. */
    private _getFieldsFromSource<TRoot, R>(selector: GenericFunction<TRoot, R>): QueryField[] {
        const body = this._bodyOf(selector);

        if (body == null) {
            throw new Error("Only arrow functions allowed in .map()")
        }

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
                    property,
                    isDirectProperty: false
                } as QueryField;
            })
        }

        const field = this._extractPropertyName(body);
        const property = this.dependencies.schema.getProperty(field);

        return [{
            destinationName: field,
            sourceName: field,
            isRename: false,
            property,
            isDirectProperty: false
        } as QueryField];
    }

    private _toField(sourceName: string, destinationName: string, isRename: boolean, value: SelectedValue): QueryField {
        return {
            sourceName,
            destinationName,
            isRename,
            property: value.property ?? undefined,
            reads: value.reads,
            isDirectProperty: value.isDirectProperty
        } as QueryField;
    }

    /**
     * The declared path of a property, which a destructured parameter hides from the source text, and the
     * source text for a computed value.
     */
    private _selectedName(selector: GenericFunction<any, any>, value: SelectedValue) {
        const body = this._bodyOf(selector);

        if (value.isDirectProperty || body == null) {
            return value.property?.id ?? "";
        }

        return this._extractPropertyName(body);
    }

    private _bodyOf(selector: GenericFunction<any, any>): string | null {
        const stringified = selector.toString();
        const arrowIndex = stringified.indexOf("=>");

        if (arrowIndex < 0) {
            return null;
        }

        return stringified.substring(arrowIndex + 2).trim();
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
        // Resolve the PropertyInfo so execution targeting can detect unmapped or
        // renamed properties, which must sort in memory after deserialization
        const { propertyName, property, reads, isDirectProperty } = this._readSortSelector(selector);

        this.request.queryOptions.add("sort", { selector: selector as any, direction, propertyName, property, reads, isDirectProperty });
    }

    /**
     * Records a similarity search, validating what can only be checked here.
     *
     * Both checks throw at the call rather than at execution. A width mismatch surfaces at
     * the backend as an error naming a column, several layers from the embedding that caused
     * it, and on a backend storing JSON it does not surface at all — every distance comes
     * back `Infinity` and the query returns an arbitrary ten rows that look like an answer.
     *
     * Only for a selector that IS the property: a vector computed from another property is not
     * that property's type or width.
     */
    protected setNearestQueryOption(selector: GenericFunction<TShape, TShape[keyof TShape]>, vector: number[], count: number) {
        const { propertyName, property, reads, isDirectProperty } = this._readSortSelector(selector);

        if (isDirectProperty === true && property != null && property.type !== SchemaTypes.Vector) {
            throw new Error(`.nearest() needs a vector property.  Property: ${propertyName}, Type: ${property.type}`);
        }

        if (isDirectProperty === true && property?.dimensions != null && property.dimensions !== vector.length) {
            throw new Error(`.nearest() was given a vector of the wrong width.  Property: ${propertyName}, Expected: ${property.dimensions}, Received: ${vector.length}`);
        }

        this.request.queryOptions.add("nearest", { selector: selector as any, propertyName, property, reads, isDirectProperty, vector, count });
    }

    protected setSkipQueryOption(amount: number) {
        this.request.queryOptions.add("skip", amount);
    }

    protected setTakeQueryOption(amount: number) {
        this.request.queryOptions.add("take", amount);
    }
}
