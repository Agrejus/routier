import { IdType } from "../../schema/types";
import { UnknownRecord } from "../../utilities/types";
import { QueryOption } from "../query/types";
import { nearestBy } from "../query/similarity";
import { DataTranslator } from "./DataTranslator";

/**
 * A stored vector as a list of numbers, whatever the driver handed back.
 *
 * Three shapes reach here and all are legitimate. A JSON column decoded by
 * `decodeJsonColumns` is already an array. A driver with no type parser for its native vector
 * type returns the literal text — `pg` does exactly this for pgvector, giving `"[1,2,3]"`,
 * which happens to be JSON. Anything else is not a vector, and `null` sorts it last rather
 * than throwing.
 */
const toVector = (value: unknown): number[] | null => {
    if (Array.isArray(value)) {
        return value as number[];
    }

    if (typeof value !== "string") {
        return null;
    }

    try {
        const parsed = JSON.parse(value);

        return Array.isArray(parsed) ? parsed as number[] : null;
    } catch {
        return null;
    }
};

export class SqlTranslator<TRoot extends {}, TShape> extends DataTranslator<TRoot, TShape> {

    count<TResult extends number>(data: unknown, _: QueryOption<TShape, "count">): TResult {
        if (Array.isArray(data) && data.length > 0) {
            // Count is returned as the property alias on the query.
            //
            // Driver-specific coercion does NOT belong here. Some drivers return COUNT(*)
            // as a bigint string rather than a number; which ones is a fact about those
            // drivers, so a plugin whose driver deviates overrides this method. Naming them
            // here is how engine knowledge starts accumulating in a storage-agnostic
            // package — one bug fix at a time.
            return data[0].count;
        }

        return data as TResult;
    }

    min<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "min">): TResult {
        return this.shapeResult(data);
    }

    max<TResult extends string | number | Date>(data: unknown, _: QueryOption<TShape, "max">): TResult {
        return this.shapeResult(data);
    }

    sum<TResult extends number>(data: unknown, _: QueryOption<TShape, "sum">): TResult {
        return this.shapeResult(data);
    }

    private shapeResult<TResult>(data: unknown) {
        if (Array.isArray(data) && data.length > 0) {
            // Shape the result
            return data[0];
        }

        return data as TResult;
    }

    distinct<TResult>(data: unknown, _: QueryOption<TShape, "distinct">): TResult {
        return data as TResult;
    }

    filter<TResult>(data: unknown, _: QueryOption<TShape, "filter">): TResult {
        return data as TResult;
    }

    skip(data: unknown, _: QueryOption<TShape, "skip">): TShape {
        return data as TShape;
    }

    take(data: unknown, _: QueryOption<TShape, "take">): TShape {
        return data as TShape;
    }

    sort(data: unknown, _: QueryOption<TShape, "sort">): TShape {
        return data as TShape;
    }

    /**
     * Scores in memory, unlike every other shaper here.
     *
     * The pass-throughs above are safe because the SQL that produced these rows contained the
     * corresponding clause. No `sql-core` statement contains a similarity ordering — engines
     * that can express one are the exception, not the rule — so passing the data through
     * would return whatever order the engine happened to produce.
     *
     * A plugin whose engine DID push the search down overrides this with a pass-through,
     * gated on `option.target`. Postgres is the only one today.
     *
     * Rows arrive keyed by storage column name and are read that way rather than through the
     * option's selector, because the selector is written against the entity shape and these
     * rows have not been deserialized into it yet.
     */
    nearest(data: unknown, option: QueryOption<TShape, "nearest">): TShape {

        if (Array.isArray(data) === false) {
            return data as TShape;
        }

        const { property, propertyName, vector, count } = option.value;
        const column = property?.getResolvedName() ?? propertyName;

        return nearestBy(data, vector, count, row => toVector((row as UnknownRecord)[column])) as TShape;
    }

    group<T>(data: unknown, option: QueryOption<T, "group">): T {

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
                        field.property.setValue(item, field.property.deserialize(value));
                    }
                }
            }

            group[keyValue].push(item);
        }

        return group as T;
    }

    map(data: unknown, option: QueryOption<TShape, "map">): TShape {
        if (Array.isArray(data) == false) {
            throw new Error("Can only map an array of data");
        }

        if (this.query.options.has("count") && data.length === 1) {
            // data here is the shape of { count: number }[] and will map to nothing.  
            // Return the original data and let count take care of this
            return data as TShape;
        }

        const response = [];

        for (let i = 0, length = data.length; i < length; i++) {

            for (let j = 0, l = option.value.fields.length; j < l; j++) {
                const field = option.value.fields[j];

                if (field.property != null) {
                    const value = field.property.getValue(data[i]);

                    if (value != null) {
                        field.property.setValue(data[i], field.property.deserialize(value));
                    }
                }
            }

            response.push(option.value.selector(data[i]));
        }

        return response as TShape;
    }
}