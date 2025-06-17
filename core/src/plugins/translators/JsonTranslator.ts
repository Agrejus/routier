import { DataTranslator } from "./DataTranslator";
import { assertIsArray, assertIsNotNull, isDate } from "../../utilities/index";
import { QueryField, QuerySort } from "../types";

export class JsonTranslator<TEntity extends {}, TShape> extends DataTranslator<TEntity, TShape> {

    override translate(data: unknown): TShape {
        const filteredData = this.filter(data);
        return super.translate(filteredData);
    }

    map<T>(data: unknown): T {

        const map = this.query.options.getValue<(item: TEntity) => unknown>("map")
        if (map == null) {
            throw new Error("Cannot find internal map function");
        }

        if (Array.isArray(data) == false) {
            throw new Error("Can only map an array of data");
        }

        const response = [];

        for (let i = 0, length = data.length; i < length; i++) {
            response.push(map(data[i]));
        }

        return response as T;
    }

    // data should be the result we are looking for 
    count<T extends number>(data: unknown): T {

        if (Array.isArray(data)) {
            return data.length as T;
        }

        throw new Error("Cannot count resulting data, it must be an array.  Please return array of data for function: count()");
    }

    min<T extends string | number | Date>(data: unknown): T {
        return this._minMax(data, "min", (a: any, b: any) => a - b);
    }

    max<T extends string | number | Date>(data: unknown): T {
        return this._minMax(data, "max", (a: any, b: any) => b - a);
    }

    sort<T>(data: unknown): T {

        const sort = this.query.options.getValue<QuerySort[]>("sort");

        if (Array.isArray(data) && sort != null) {

            for (const item of sort) {
                data.sort((a, b) => {
                    if (item.direction === "asc") {
                        return (item.selector(a) as any) - (item.selector(b) as any);
                    }

                    return (item.selector(b) as any) - (item.selector(a) as any);
                })
            }
        }

        return data as T;
    }

    private _formatMissingMapError(functionName: string) {
        return `${functionName}() operation can only be performed when one field is mapped for a result.  Ex.  myset.map(x => x.someNumber).${functionName}()`
    }

    private _formatDataNotArrayError(functionName: string) {
        return `Cannot sum resulting data, it must be an array.  Please return array of data for function: ${functionName}()`
    }

    sum<T extends number>(data: unknown): T {

        assertIsArray(data, this._formatDataNotArrayError("sum"));

        const map = this.query.options.getValue("map");

        assertIsNotNull(map, this._formatMissingMapError("sum"));

        let sum = 0;
        const field = this._getSelectionField("sum");

        for (let i = 0, length = data.length; i < length; i++) {
            const value = data[i];

            if (typeof value !== "number") {
                throw new Error(`Cannot sum, property is not a number.  Property: ${field.sourceName}`);
            }

            sum += value;
        }

        return sum as T;
    }

    distinct<T>(data: unknown): T {

        assertIsArray(data, this._formatDataNotArrayError("distinct"));

        const map = this.query.options.getValue("map");

        assertIsNotNull(map, this._formatMissingMapError("distinct"));

        const result = new Set<string | number | Date>();
        // would be nice to have property info here for type detection
        let needsDateConversion = false;

        for (let i = 0, length = data.length; i < length; i++) {
            const value = data[i];

            if (typeof value === "number" || typeof value === "string") {
                result.add(value);
                continue;
            }

            if (isDate(value)) {
                needsDateConversion = true;
                result.add(value.toISOString());
                continue;
            }

        }

        if (needsDateConversion) {
            return [...result].map(w => new Date(w)) as T;
        }

        return [...result] as T
    }

    default<T>(data: unknown): T {
        return data as T
    }

    skip<T>(data: unknown): T {
        if (Array.isArray(data)) {

            const skip = this.query.options.getValue<number>("skip");

            if (skip != null && skip > 0) {

                if (data.length < skip) {
                    return data as T;
                }

                return data.slice(skip) as T;
            }

            return data as T;
        }

        return data as T;
    }

    take<T>(data: unknown): T {
        if (Array.isArray(data)) {

            const take = this.query.options.getValue<number>("take");

            if (take != null && take > 0) {

                if (data.length < take) {
                    return data as T;
                }

                return data.slice(0, take) as T;
            }

            return data as T;
        }

        return data as T;
    }

    private _getSelectionField(name: string) {

        const fields = this.query.options.getValue<QueryField[]>("fields");

        if (fields == null ||
            fields.length === 0 ||
            fields.length > 1) {
            throw new Error(`${name}() operation can only be performed when one field is mapped for a result.  Ex.  myset.map(x => x.someNumberOrDateOrString).${name}()`)
        }

        return fields[0];
    }

    private _minMax<T extends string | number | Date>(data: unknown, name: string, sort: (a: any, b: any) => any): T {

        assertIsArray(data, this._formatDataNotArrayError(name));

        const map = this.query.options.getValue("map");

        assertIsNotNull(map, this._formatMissingMapError(name));

        data.sort(sort);

        return data[0] as T;
    }
}