import { Filter, ParamsFilter } from "../../expressions/types";
import { assertIsArray } from "../../utilities/index";
import { IQuery } from "../types";

export abstract class DataTranslator<T extends {}, TShape> {

    protected query: IQuery<T, TShape>;

    constructor(query: IQuery<T, TShape>) {
        this.query = query;
    }

    abstract count<T extends number>(data: unknown): T;
    abstract min<T extends string | number | Date>(data: unknown): T;
    abstract max<T extends string | number | Date>(data: unknown): T;
    abstract sum<T extends number>(data: unknown): T;
    abstract distinct<T>(data: unknown): T;
    abstract default<T>(data: unknown): T;
    abstract skip<T>(data: unknown): T;
    abstract take<T>(data: unknown): T;
    abstract sort<T>(data: unknown): T;
    abstract map<T>(data: unknown): T;

    // matches filter
    satisfies(document: unknown) {

        // Memory Filtering Fallback
        if (this.query.filters.length > 0) {

            for (let i = 0, length = this.query.filters.length; i < length; i++) {
                if (this.query.filters[i].params == null) {
                    // standard filtering
                    const selector = this.query.filters[i].filter as Filter<TShape>;

                    if (selector(document as TShape) === true) {
                        return true;
                    }
                    continue;
                }

                // params filtering
                const selector = this.query.filters[i].filter as ParamsFilter<TShape, any>
                if (selector([document as TShape, this.query.filters[i].params]) === true) {
                    return true;
                }
            }

            // Nothing matches
            return false;
        }

        // No filters, return true
        return true;
    }

    /// Should never call this in the db plugin if the db does the filtering
    protected filter(data: unknown): TShape {

        assertIsArray(data);

        // Memory Filtering Fallback
        if (this.query.filters.length > 0) {

            let result = data;

            for (let i = 0, length = this.query.filters.length; i < length; i++) {
                if (this.query.filters[i].params == null) {
                    // standard filtering
                    const selector = this.query.filters[i].filter as Filter<TShape>
                    result = data.filter(selector);
                    continue;
                }

                // params filtering
                const selector = this.query.filters[i].filter as ParamsFilter<TShape, any>
                result = data.filter(w => selector([w as TShape, this.query.filters[i].params]));
            }

            return result as TShape;
        }

        // Plugin did filtering
        return data as TShape;
    }

    translate(data: unknown): TShape {

        const sort = this.query.options.get<[]>("sort");
        const map = this.query.options.get("map");
        const skip = this.query.options.get<number>("skip");
        const take = this.query.options.get<number>("take");
        const count = this.query.options.get<boolean>("count");

        if (sort != null && sort.value.length > 0) {
            // don't return, we are sorting in place
            this.sort(data);
        }

        if (map?.value != null) {
            data = this.map(data) as TShape;
        }

        if (skip?.value != null && skip.value > 0) {
            data = this.skip(data) as TShape;
        }

        if (take?.value != null && take.value > 0) {
            data = this.take(data) as TShape;
        }

        if (count?.value === true) {
            return this.count(data) as TShape;
        }

        const distinct = this.query.options.get<boolean>("distinct");

        if (distinct?.value === true) {
            return this.distinct(data) as TShape;
        }

        const max = this.query.options.get<boolean>("max");

        if (max?.value === true) {
            return this.max(data) as TShape;
        }

        const min = this.query.options.get<boolean>("min");

        if (min?.value === true) {
            return this.min(data) as TShape;
        }

        const sum = this.query.options.get<boolean>("sum");

        if (sum?.value === true) {
            return this.sum(data) as TShape;
        }

        return this.default(data) as TShape;
    }
}