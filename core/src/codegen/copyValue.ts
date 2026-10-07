const isPlainObject = (value: object): boolean => {
    const prototype = Object.getPrototypeOf(value);

    return prototype === null || Object.getPrototypeOf(prototype) === null;
};

export const copyValue = (value: unknown): unknown => {
    if (typeof value !== "object" || value === null) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(copyValue);
    }

    if (Object.prototype.toString.call(value) === "[object Date]") {
        return new Date(Date.prototype.getTime.call(value));
    }

    if (isPlainObject(value)) {
        const copy: Record<string, unknown> = {};

        for (const [key, inner] of Object.entries(value)) {
            copy[key] = copyValue(inner);
        }

        return copy;
    }

    return structuredClone(value);
};
