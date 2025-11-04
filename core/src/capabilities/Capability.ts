import { MethodInfo, MethodInfoMetadata } from "./types";

export abstract class Capability {

    protected excludedNames = new Set<string>([
        "Array",
        "Set",
        "Map",
        "AbortController",
        "AbortSignal",
        "SchemaString",
        "SchemaNumber",
        "SchemaArray",
        "SchemaBoolean",
        "SchemaDate",
        "SchemaObject",
        "SchemaDefault",
        "SchemaDeserialize",
        "SchemaDistinct",
        "SchemaFrom",
        "SchemaIdentity",
        "SchemaIndex",
        "SchemaKey",
        "SchemaNullable",
        "SchemaOptional",
        "SchemaReadonly",
        "SchemaSerialize",
        "SchemaTracked",
        "SchemaComputed",
        "SchemaFunction",
        "SchemaBase",
        "SchemaDefinition"
    ]);

    protected isValidObject(obj: unknown): obj is object {
        return typeof obj === "object" && obj !== null;
    }

    protected isCallableMethod(descriptor: PropertyDescriptor | undefined, key: string | symbol): boolean {
        return (
            descriptor?.value &&
            typeof descriptor.value === 'function' &&
            key !== 'constructor' &&
            key !== 'undefined'
        );
    }


    private canExplore(descriptor: PropertyDescriptor) {
        if (typeof descriptor.value !== "object") {
            return false;
        }

        if (descriptor.value == null) {
            return false
        }

        const name = this.getName(descriptor.value);

        if (name == null) {
            return true;
        }

        return this.excludedNames.has(name) === false
    }

    private getName(value: object) {
        if (value.constructor != null) {
            return value.constructor.name;
        }

        return null;
    }

    private getPath(info: MethodInfoMetadata, propertyName: string | symbol) {

        let parent = info.parent;
        const path = [info.propertyName, propertyName];

        while (parent != null) {

            path.unshift(parent.propertyName);
            parent = parent.parent;
        }

        return path.join(".");
    }

    protected explore(instance: unknown, onDiscover: (info: MethodInfoMetadata, methodInfo: MethodInfo) => void): void {
        if (!this.isValidObject(instance)) {
            return;
        }

        const explore: MethodInfoMetadata[] = [{ instance, propertyName: this.getName(instance) }];
        const visited = new Set<object>();

        for (let i = 0; i < explore.length; i++) {

            const info = explore[i];
            const item = info.instance;

            if (visited.has(item)) {
                continue;
            }

            const allKeys = [
                ...Object.getOwnPropertyNames(item),
                ...Object.getOwnPropertySymbols(item),
            ];

            for (const key of allKeys) {

                const descriptor = Object.getOwnPropertyDescriptor(item, key);

                const isCallable = this.isCallableMethod(descriptor, key);

                onDiscover(info, {
                    name: key,
                    isCallable
                });

                if (this.canExplore(descriptor) === false) {
                    continue;
                }

                const path = this.getPath(info, key);
                explore.push({ instance: descriptor.value, parent: info, propertyName: key, path });
            }

            visited.add(item);
        }
    }

    abstract apply(instance: unknown): void;
}