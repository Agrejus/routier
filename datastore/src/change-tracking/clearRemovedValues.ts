import { PropertyInfo, SchemaTypes } from "@routier/core/schema";

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null;

const holdsStoredValue = (property: PropertyInfo<{}>) => property.type !== SchemaTypes.Computed && property.type !== SchemaTypes.Function;

const storedPropertiesCache = new WeakMap<PropertyInfo<{}>[], PropertyInfo<{}>[]>();

const storedPropertiesOf = (properties: PropertyInfo<{}>[]) => {
    let stored = storedPropertiesCache.get(properties);

    if (stored === undefined) {
        stored = properties.filter(holdsStoredValue);
        storedPropertiesCache.set(properties, stored);
    }

    return stored;
};

export const clearRemovedValues = (destination: Fields, source: Fields, properties: PropertyInfo<{}>[]): void => {
    const stored = storedPropertiesOf(properties);

    for (let i = 0, length = stored.length; i < length; i++) {
        const property = stored[i];
        const name = property.name;

        const value = source[name];

        if (value === undefined) {
            delete destination[name];
            continue;
        }

        if (value === null) {
            destination[name] = null;
            continue;
        }

        const target = destination[name];

        if (isFields(target) && isFields(value)) {
            clearRemovedValues(target, value, property.children);
        }
    }
};
