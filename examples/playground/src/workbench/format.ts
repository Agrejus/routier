import type { ModuleValue } from '../sandbox/execute';

export const format = (value: ModuleValue): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message;

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};
