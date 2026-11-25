import { REDACTED } from "../../expressions/redact";
import { UnknownRecord } from "../../utilities/types";
import { PropertyInfo } from "../PropertyInfo";

const isRecord = <TValue>(value: TValue): value is TValue & UnknownRecord =>
    typeof value === "object" && value !== null && Array.isArray(value) === false;

const hidePath = (record: UnknownRecord, [name, ...rest]: string[]): UnknownRecord => {
    const value = record[name];

    if (value == null) {
        return record;
    }

    if (rest.length === 0) {
        return { ...record, [name]: REDACTED };
    }

    return isRecord(value) ? { ...record, [name]: hidePath(value, rest) } : record;
};

/**
 * A copy of `row` with the value of every sensitive property replaced by `REDACTED`, for
 * Routier's own logs. The row itself is not changed, and a row with nothing sensitive in it is
 * returned as it is.
 */
export const redactEntity = <TEntity extends {}, TValue>(schema: { sensitiveProperties: readonly PropertyInfo<TEntity>[] }, row: TValue): TValue | UnknownRecord => {
    if (schema.sensitiveProperties.length === 0 || isRecord(row) === false) {
        return row;
    }

    return schema.sensitiveProperties.reduce<UnknownRecord>((redacted, property) => hidePath(redacted, property.getPathArray()), row);
};
