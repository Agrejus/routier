import { DataTranslator } from "./DataTranslator";
import { assertIsArray, isDate } from "../../utilities/index";
import { QueryOption } from "../query/types";
import { ParamsFilter } from "../../expressions/types";

export class JsonTranslator<TRoot extends {}, TShape> extends DataTranslator<TRoot, TShape> {

    override filter<TResult>(data: unknown, option: QueryOption<TShape, "filter">): TResult {

        assertIsArray(data);

        if (option.value.filter) {

            if (option.value.params == null) {
                // standard filtering
                return data.filter(option.value.filter) as TResult;
            }

            // params filtering
            const selector = option.value.filter as ParamsFilter<unknown, {}>
            return data.filter(w => selector([w, option.value.params])) as TResult;
        }

        return data as TResult;
    }

    override map<T>(data: unknown, option: QueryOption<T, "map">): T {

        if (Array.isArray(data) == false) {
            throw new Error("Can only map an array of data");
        }

        const response = [];

        for (let i = 0, length = data.length; i < length; i++) {
            response.push(option.value.selector(data[i]));
        }

        return response as T;
    }

    override count<TResult extends number>(data: unknown, _: QueryOption<TShape, "count">): TResult {

        if (Array.isArray(data)) {
            return data.length as TResult;
        }

        throw new Error("Cannot count resulting data, it must be an array.  Please return array of data for function: count()");
    }

    override min<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "min">): TResult {
        return this._minMax(data, "min", (a: any, b: any) => a - b);
    }

    override max<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "max">): TResult {
        return this._minMax(data, "max", (a: any, b: any) => b - a);
    }

    override sort<TResult>(data: unknown, option: QueryOption<TShape, "sort">): TResult {

        if (Array.isArray(data)) {

            data.sort((a, b) => {
                if (option.value.direction === "asc") {
                    return (option.value.selector(a) as any) - (option.value.selector(b) as any);
                }

                return (option.value.selector(b) as any) - (option.value.selector(a) as any);
            });
        }

        return data as TResult;
    }

    override sum<TResult extends number>(data: unknown, _: QueryOption<TShape, "sum">): TResult {

        assertIsArray(data, this._formatDataNotArrayError("sum"));
        debugger;
        const map = this.query.options.getLast("map");

        let sum = 0;
        const field = this._getSelectionField("sum", map);

        for (let i = 0, length = data.length; i < length; i++) {
            const value = data[i];

            if (typeof value !== "number") {
                throw new Error(`Cannot sum, property is not a number.  Property: ${field.sourceName}`);
            }

            sum += value;
        }

        return sum as TResult;
    }

    override distinct<TResult>(data: unknown, _: QueryOption<TShape, "distinct">): TResult {

        assertIsArray(data, this._formatDataNotArrayError("distinct"));

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
            return [...result].map(w => new Date(w)) as TResult;
        }

        return [...result] as TResult
    }

    override skip<TResult>(data: unknown, option: QueryOption<TShape, "skip">): TResult {

        if (Array.isArray(data)) {

            if (option.value > 0) {

                if (data.length < option.value) {
                    // We don't have enough data to skip, return an empty array
                    return [] as TResult;
                }

                return data.slice(option.value) as TResult;
            }

            return data as TResult;
        }

        return data as TResult;
    }

    override take<TResult>(data: unknown, option: QueryOption<TShape, "take">): TResult {
        if (Array.isArray(data)) {

            if (option.value > 0) {

                if (data.length < option.value) {
                    return data as TResult;
                }

                return data.slice(0, option.value) as TResult;
            }

            return data as TResult;
        }

        return data as TResult;
    }

    private _getSelectionField(name: string, mapOption: QueryOption<TShape, "map"> | null) {

        if (mapOption == null ||
            mapOption.value.fields.length === 0 ||
            mapOption.value.fields.length > 1) {
            throw new Error(`${name}() operation can only be performed when one field is mapped for a result.  Ex.  myset.map(x => x.someNumberOrDateOrString).${name}()`)
        }

        return mapOption.value.fields[0];
    }

    private _minMax<T extends string | number | Date>(data: unknown, name: string, sort: (a: any, b: any) => any): T {

        assertIsArray(data, this._formatDataNotArrayError(name));

        data.sort(sort);

        if (data.length === 0) {
            throw new Error("Cannot perform operation on empty array, result query contains no data")
        }

        return data[0] as T;
    }

    private _formatDataNotArrayError(functionName: string) {
        return `Cannot sum resulting data, it must be an array.  Please return array of data for function: ${functionName}()`
    }
}