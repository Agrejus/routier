export const hash = (value: string, seed: number = 0) => {
    // From Stack Overflow
    // https://stackoverflow.com/a/52171480/3329760
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;

    for (let i = 0, ch: number; i < value.length; i++) {
        ch = value.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Fast string hash optimized for comparisons.
 * Uses djb2 algorithm - very fast and good distribution for short to medium strings.
 * Same input always produces same output (deterministic).
 * 
 * @param value - The string to hash
 * @param seed - Optional seed value (default: 5381)
 * @returns A positive 32-bit integer hash value
 * 
 * @example
 * ```ts
 * fastHash("test") === fastHash("test") // true
 * fastHash("test") !== fastHash("test2") // true
 * ```
 */
export const fastHash = (value: string, seed: number = 5381): number => {
    let hash = seed;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) + hash) + value.charCodeAt(i);
    }
    return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Converts any value to a readable string representation.
 * Handles primitives, objects, arrays, classes, dates, errors, and functions.
 * Supports depth limiting to prevent infinite recursion on circular references.
 * 
 * @param obj - The value to stringify
 * @param maxDepth - Maximum depth for nested objects (default: 3)
 * @param currentDepth - Current recursion depth (default: 0)
 * @returns String representation of the value
 * 
 * @example
 * ```ts
 * stringifyObject({ name: "test", count: 5 }) // '{ name: "test", count: 5 }'
 * stringifyObject([1, 2, 3]) // '[1, 2, 3]'
 * stringifyObject(new Date()) // 'Date(2024-01-01T00:00:00.000Z)'
 * ```
 */
export function stringifyObject(obj: unknown, maxDepth: number = 3, currentDepth: number = 0): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';

    const type = typeof obj;

    switch (type) {
        case 'string':
            return `"${obj}"`;
        case 'number':
        case 'boolean':
            return String(obj);
        case 'function':
            return `[Function: ${getFunctionName(obj as Function)}]`;
        case 'object':
            if (currentDepth >= maxDepth) {
                return '[Max Depth Reached]';
            }
            return stringifyObjectValue(obj, maxDepth, currentDepth);
        default:
            return `[${type}]`;
    }
}

function getFunctionName(fn: Function): string {
    const name = fn.name;
    return name || 'anonymous';
}

function getObjectProperties(obj: any): Record<string, any> {
    const properties: Record<string, any> = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            properties[key] = obj[key];
        }
    }

    return properties;
}

function stringifyObjectValue(obj: any, maxDepth: number, currentDepth: number): string {
    if (obj === null) return 'null';

    if (obj instanceof Date) {
        return `Date(${obj.toISOString()})`;
    }

    if (obj instanceof Error) {
        return `Error(${obj.message})`;
    }

    if (obj instanceof RegExp) {
        return obj.toString();
    }

    if (Array.isArray(obj)) {
        return stringifyArray(obj, maxDepth, currentDepth);
    }

    if (obj.constructor && obj.constructor.name !== 'Object') {
        return stringifyClassInstance(obj, maxDepth, currentDepth);
    }

    return stringifyPlainObject(obj, maxDepth, currentDepth);
}

function stringifyArray(arr: any[], maxDepth: number, currentDepth: number): string {
    if (arr.length === 0) return '[]';

    const items = arr.slice(0, 5).map(item =>
        stringifyObject(item, maxDepth, currentDepth + 1)
    );

    const suffix = arr.length > 5 ? `... (+${arr.length - 5} more)` : '';
    return `[${items.join(', ')}${suffix}]`;
}

function stringifyClassInstance(obj: any, maxDepth: number, currentDepth: number): string {
    const className = obj.constructor.name;
    const properties = getObjectProperties(obj);

    if (Object.keys(properties).length === 0) {
        return `${className} {}`;
    }

    const props = Object.entries(properties)
        .slice(0, 5)
        .map(([key, value]) => {
            const isPrimitive = value === null || value === undefined ||
                (typeof value !== 'object' && typeof value !== 'function');
            const depth = isPrimitive ? currentDepth : currentDepth + 1;
            return `${key}: ${stringifyObject(value, maxDepth, depth)}`;
        });

    const suffix = Object.keys(properties).length > 5 ?
        `... (+${Object.keys(properties).length - 5} more)` : '';

    return `${className} { ${props.join(', ')}${suffix} }`;
}

function stringifyPlainObject(obj: any, maxDepth: number, currentDepth: number): string {
    const properties = getObjectProperties(obj);

    if (Object.keys(properties).length === 0) {
        return '{}';
    }

    const props = Object.entries(properties)
        .slice(0, 5)
        .map(([key, value]) => {
            const isPrimitive = value === null || value === undefined ||
                (typeof value !== 'object' && typeof value !== 'function');
            const depth = isPrimitive ? currentDepth : currentDepth + 1;
            return `${key}: ${stringifyObject(value, maxDepth, depth)}`;
        });

    const suffix = Object.keys(properties).length > 5 ?
        `... (+${Object.keys(properties).length - 5} more)` : '';

    return `{ ${props.join(', ')}${suffix} }`;
}