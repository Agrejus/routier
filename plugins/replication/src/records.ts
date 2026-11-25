import type { UnknownRecord } from '@routier/core/utilities';

/** Whether `value` is a plain object, rather than null, an array, a function or a primitive. */
export const isRecord = <TValue>(value: TValue): value is TValue & UnknownRecord =>
    typeof value === 'object' && value !== null && Array.isArray(value) === false;
