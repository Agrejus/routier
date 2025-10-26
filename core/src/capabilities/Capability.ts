import { ExplorationOptions, MethodInfo } from "./types";

export abstract class Capability {

    protected isValidObject(obj: unknown): obj is object {
        return typeof obj === "object" && obj !== null;
    }

    protected getObjectName(obj: unknown): string {
        return (obj as any)?.constructor?.name || 'root';
    }

    protected exploreObjectMethods(
        obj: unknown,
        callback: (methodInfo: MethodInfo) => void,
        options: ExplorationOptions = {}
    ): void {
        if (!this.isValidObject(obj)) {
            return;
        }

        const {
            maxDepth = 10,
            includeNonEnumerable = false,
            filter = () => true
        } = options;

        const rootName = this.getObjectName(obj);
        const visited = new Set<object>();

        // Explore root methods
        this.exploreRootMethods(obj, callback, filter);

        // Explore nested methods
        this.exploreNestedMethods(obj, callback, filter, [rootName], visited, maxDepth, includeNonEnumerable);
    }

    protected exploreRootMethods(
        obj: object,
        callback: (methodInfo: MethodInfo) => void,
        filter: (methodInfo: MethodInfo) => boolean
    ): void {
        const methodNames = this.extractMethodNames(obj);

        for (const methodName of methodNames) {
            const methodInfo: MethodInfo = {
                methodName,
                instance: obj,
                methodPath: [String(methodName)],
                parent: null
            };

            if (filter(methodInfo)) {
                callback(methodInfo);
            }
        }
    }

    protected extractMethodNames(obj: unknown): (string | symbol)[] {
        const methodNames = new Set<string | symbol>();
        let prototype = obj;

        while (prototype && prototype !== Object.prototype) {
            const allKeys = [
                ...Object.getOwnPropertyNames(prototype),
                ...Object.getOwnPropertySymbols(prototype),
            ];

            for (const key of allKeys) {
                const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
                if (this.isCallableMethod(descriptor, key)) {
                    methodNames.add(key);
                }
            }
            prototype = Object.getPrototypeOf(prototype);
        }
        return Array.from(methodNames);
    }

    protected isCallableMethod(descriptor: PropertyDescriptor | undefined, key: string | symbol): boolean {
        return (
            descriptor?.value &&
            typeof descriptor.value === 'function' &&
            key !== 'constructor' &&
            key !== 'undefined'
        );
    }

    protected isCustomClassInstance(value: unknown): boolean {
        if (value === null || (typeof value !== "object" && typeof value !== "function")) {
            return false;
        }

        const objectTag = Object.prototype.toString.call(value);
        // Most built-ins have distinct tags; user classes default to "[object Object]"
        // Caveat: Symbol.toStringTag can spoof this.
        return objectTag === "[object Object]";
    }

    protected shouldProcessProperty(property: unknown): boolean {
        return (
            this.isCustomClassInstance(property) &&
            property?.constructor.name !== "Object"
        );
    }

    protected exploreNestedMethods(
        obj: unknown,
        callback: (methodInfo: MethodInfo) => void,
        filter: (methodInfo: MethodInfo) => boolean,
        initialPath: string[],
        visited: Set<object>,
        maxDepth: number,
        includeNonEnumerable: boolean
    ): void {
        if (visited.has(obj as object) || initialPath.length > maxDepth) {
            return;
        }

        visited.add(obj as object);

        if (!this.isValidObject(obj)) {
            return;
        }

        const properties = includeNonEnumerable
            ? Object.getOwnPropertyNames(obj)
            : Object.keys(obj);

        for (const propertyName of properties) {
            const property = (obj as any)[propertyName];

            if (!this.shouldProcessProperty(property)) {
                continue;
            }

            const newPath = [...initialPath, propertyName];

            // Explore methods on this property
            this.explorePropertyMethods(property, callback, filter, newPath, obj);

            // Recursively explore nested objects
            this.exploreNestedMethods(
                property,
                callback,
                filter,
                newPath,
                visited,
                maxDepth,
                includeNonEnumerable
            );
        }
    }

    private explorePropertyMethods(
        property: any,
        callback: (methodInfo: MethodInfo) => void,
        filter: (methodInfo: MethodInfo) => boolean,
        methodPath: string[],
        parent: any
    ): void {
        const methodNames = this.extractMethodNames(property);

        for (const methodName of methodNames) {
            const fullMethodPath = [...methodPath, String(methodName)];
            const methodInfo: MethodInfo = {
                methodName,
                instance: property,
                methodPath: fullMethodPath,
                parent
            };

            if (filter(methodInfo)) {
                callback(methodInfo);
            }
        }
    }

    protected stringifyValue(value: unknown, maxDepth: number = 3, currentDepth: number = 0): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';

        const type = typeof value;

        switch (type) {
            case 'string':
                return `"${value}"`;
            case 'number':
            case 'boolean':
                return String(value);
            case 'function':
                return `[Function: ${this.getFunctionName(value as Function)}]`;
            case 'object':
                if (currentDepth >= maxDepth) {
                    return '[Max Depth Reached]';
                }
                return this.stringifyObject(value, maxDepth, currentDepth);
            default:
                return `[${type}]`;
        }
    }

    protected getFunctionName(fn: Function): string {
        const name = fn.name;
        return name || 'anonymous';
    }

    protected stringifyObject(obj: any, maxDepth: number, currentDepth: number): string {
        if (obj === null) return 'null';

        // Handle special object types
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
            return this.stringifyArray(obj, maxDepth, currentDepth);
        }

        if (obj.constructor && obj.constructor.name !== 'Object') {
            return this.stringifyClassInstance(obj, maxDepth, currentDepth);
        }

        return this.stringifyPlainObject(obj, maxDepth, currentDepth);
    }

    protected stringifyArray(arr: any[], maxDepth: number, currentDepth: number): string {
        if (arr.length === 0) return '[]';

        const items = arr.slice(0, 5).map(item =>
            this.stringifyValue(item, maxDepth, currentDepth + 1)
        );

        const suffix = arr.length > 5 ? `... (+${arr.length - 5} more)` : '';
        return `[${items.join(', ')}${suffix}]`;
    }

    protected stringifyClassInstance(obj: any, maxDepth: number, currentDepth: number): string {
        const className = obj.constructor.name;
        const properties = this.getObjectProperties(obj);

        if (Object.keys(properties).length === 0) {
            return `${className} {}`;
        }

        const props = Object.entries(properties)
            .slice(0, 5)
            .map(([key, value]) => {
                // For primitive values, don't increase depth
                const isPrimitive = value === null || value === undefined ||
                    (typeof value !== 'object' && typeof value !== 'function');
                const depth = isPrimitive ? currentDepth : currentDepth + 1;
                return `${key}: ${this.stringifyValue(value, maxDepth, depth)}`;
            });

        const suffix = Object.keys(properties).length > 5 ?
            `... (+${Object.keys(properties).length - 5} more)` : '';

        return `${className} { ${props.join(', ')}${suffix} }`;
    }

    protected stringifyPlainObject(obj: any, maxDepth: number, currentDepth: number): string {
        const properties = this.getObjectProperties(obj);

        if (Object.keys(properties).length === 0) {
            return '{}';
        }

        const props = Object.entries(properties)
            .slice(0, 5)
            .map(([key, value]) => {
                // For primitive values, don't increase depth
                const isPrimitive = value === null || value === undefined ||
                    (typeof value !== 'object' && typeof value !== 'function');
                const depth = isPrimitive ? currentDepth : currentDepth + 1;
                return `${key}: ${this.stringifyValue(value, maxDepth, depth)}`;
            });

        const suffix = Object.keys(properties).length > 5 ?
            `... (+${Object.keys(properties).length - 5} more)` : '';

        return `{ ${props.join(', ')}${suffix} }`;
    }

    protected getObjectProperties(obj: any): Record<string, any> {
        const properties: Record<string, any> = {};

        // Get enumerable properties
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                properties[key] = obj[key];
            }
        }

        return properties;
    }

    abstract apply(instance: unknown): void;
}