import { QueryOption } from "../query/types";
import { DataTranslator } from "./DataTranslator";

export class SqlTranslator<TRoot extends {}, TShape> extends DataTranslator<TRoot, TShape> {

    count<TResult extends number>(data: unknown, _: QueryOption<TShape, "count">): TResult {
        if (Array.isArray(data) && data.length > 0) {
            // Count should be returned as the property alias on the query
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