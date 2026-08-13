import { DataTranslator } from "./DataTranslator";
import { QueryOption } from "../query/types";
import { nearestBy } from "../query/similarity";
import { executeJoin, JoinInnerSide, toEntityShape } from "../query/join";
import { assertIsArray } from "../../assertions";
import { ParamsFilter } from "../../expressions";
import { isDate, UnknownRecord } from "../../utilities";
import { IdType } from "../../schema";
import { IQuery } from "../types";

export class JsonTranslator<TRoot extends {}, TShape> extends DataTranslator<TRoot, TShape> {

    private readonly innerSide?: JoinInnerSide;

    /**
     * @param innerSide The inner collection's rows, when this query carries a `join` option.
     * A plugin that omits it for a query that HAS a join gets a throw from `join()` rather than
     * a silently un-joined result.
     */
    constructor(query: IQuery<TRoot, TShape>, innerSide?: JoinInnerSide) {
        super(query);
        this.innerSide = innerSide;
    }

    /**
     * The hash join itself, over rows already in memory — the floor every non-SQL backend
     * stands on.
     *
     * Both halves are deserialized here, each with its own schema, because that is where the
     * `===` on key values is specified to happen: in entity shape, by the property names the
     * caller wrote in the key selectors. A `from`-renamed column reads correctly for free.
     */
    override join<TResult>(data: unknown, option: QueryOption<TShape, "join">): TResult {

        if (Array.isArray(data) === false) {
            return data as TResult;
        }

        if (this.innerSide == null) {
            throw new Error(
                `Cannot join: this plugin did not supply the inner collection's rows.  ` +
                `A plugin whose translator inherits JsonTranslator.join must construct it with the inner side ` +
                `(new JsonTranslator(operation, { innerSchema, innerRows })) when the query carries a join option.`
            );
        }

        const { innerSchema, innerRows } = this.innerSide;

        return executeJoin({
            option: option.value,
            outerRows: toEntityShape(this.query.schema, data),
            innerRows: toEntityShape(innerSchema, innerRows)
        }) as TResult;
    }

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

        const response = Array.from({ length: data.length });

        for (let i = 0, length = data.length; i < length; i++) {

            for (let j = 0, l = option.value.fields.length; j < l; j++) {
                const field = option.value.fields[j];

                if (field.property != null) {
                    const value = field.property.getValue(data[i]);

                    if (value != null) {
                        // Some types do not support deserialization (Array, Function, Computed, etc), just directly set the incoming value
                        const resolvedValue = field.property.supportsDeserialization ? field.property.deserialize(value) : value;
                        field.property.setValue(data[i], resolvedValue);
                    }
                }
            }

            response[i] = option.value.selector(data[i]);
        }

        return response as T;
    }

    override group<T>(data: unknown, option: QueryOption<T, "group">): T {

        if (Array.isArray(data) == false) {
            throw new Error("Can only group an array of data");
        }

        const group: Record<IdType, unknown[]> = {};

        for (let i = 0, length = data.length; i < length; i++) {

            const keyValue = option.value.selector(data[i]) as IdType;

            if (!group[keyValue]) {
                group[keyValue] = [];
            }

            const item: UnknownRecord = {};

            for (let j = 0, l = option.value.fields.length; j < l; j++) {
                const field = option.value.fields[j];

                if (field.property != null) {
                    const value = field.property.getValue(data[i]);

                    if (value != null) {
                        // Some types do not support deserialization (Array, Function, Computed, etc), just directly set the incoming value
                        const resolvedValue = field.property.supportsDeserialization ? field.property.deserialize(value) : value;
                        field.property.setValue(item, resolvedValue);
                        continue;
                    }

                    // The property exists, lets set it to the value (null/undefined)
                    if (Object.hasOwn(data[i], field.destinationName)) {
                        field.property.setValue(item, value);
                    }
                }
            }

            group[keyValue].push(item);
        }

        return group as T;
    }

    override count<TResult extends number>(data: unknown, _: QueryOption<TShape, "count">): TResult {

        if (Array.isArray(data)) {
            return data.length as TResult;
        }

        throw new Error("Cannot count resulting data, it must be an array.  Please return array of data for function: count()");
    }

    // Relational comparison instead of subtraction, for the same reason as sort():
    // subtraction is NaN for strings, which made min()/max() return an arbitrary element.
    // Nulls order first ascending — min() of a column with nulls is null, max() is the
    // largest value — matching what sort() does with the same data.
    override min<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "min">): TResult {
        return this._minMax(data, "min", (a: any, b: any) => {
            if (a === b) {
                return 0;
            }

            if (a == null) {
                return -1;
            }

            if (b == null) {
                return 1;
            }

            return a < b ? -1 : 1;
        });
    }

    override max<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "max">): TResult {
        return this._minMax(data, "max", (a: any, b: any) => {
            if (a === b) {
                return 0;
            }

            if (a == null) {
                return 1;
            }

            if (b == null) {
                return -1;
            }

            return a < b ? 1 : -1;
        });
    }

    override sort<TResult>(data: unknown, option: QueryOption<TShape, "sort">): TResult {

        if (Array.isArray(data)) {
            const direction = option.value.direction === "asc" ? 1 : -1;

            // Relational comparison instead of subtraction — subtraction is NaN
            // for strings, which leaves the array unsorted
            data.sort((x, y) => {
                const a = option.value.selector(x) as any;
                const b = option.value.selector(y) as any;

                if (a === b) {
                    return 0;
                }

                if (a == null) {
                    return -1 * direction;
                }

                if (b == null) {
                    return 1 * direction;
                }

                return (a < b ? -1 : 1) * direction;
            });
        }

        return data as TResult;
    }

    /**
     * The similarity search itself, over values already in memory.
     *
     * This is the floor the whole feature stands on: it is reached whenever the backend did
     * not do the search, which is every backend except the ones with a native vector index.
     * It reads the property through the option's selector, so it works on any shape the rows
     * arrive in.
     */
    override nearest<TResult>(data: unknown, option: QueryOption<TShape, "nearest">): TResult {

        if (Array.isArray(data) === false) {
            return data as TResult;
        }

        const { selector, vector, count } = option.value;

        return nearestBy(data, vector, count, row => selector(row) as unknown as number[] | null) as TResult;
    }

    override sum<TResult extends number>(data: unknown, _: QueryOption<TShape, "sum">): TResult {

        assertIsArray(data, this._formatDataNotArrayError("sum"));

        if (data.length === 0) {
            throw new Error("Cannot perform operation on empty array, result query contains no data")
        }

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

        if (data.length === 0) {
            throw new Error("Cannot perform operation on empty array, result query contains no data")
        }

        // A single pass, not sort-and-take-first: O(n) for an O(n) question, and it does not
        // MUTATE the array the caller handed us — the sort did.  The caller's comparator is
        // reused so min and max keep their null ordering from one body.
        let best = data[0];

        for (let i = 1, length = data.length; i < length; i++) {
            const value = data[i];

            // Array.prototype.sort moves undefined elements to the END without consulting the
            // comparator. Mirror that: undefined is never selected unless every element is.
            if (value === undefined) {
                continue;
            }

            if (best === undefined || sort(value, best) < 0) {
                best = value;
            }
        }

        return best as T;
    }

    private _formatDataNotArrayError(functionName: string) {
        return `Cannot sum resulting data, it must be an array.  Please return array of data for function: ${functionName}()`
    }
}