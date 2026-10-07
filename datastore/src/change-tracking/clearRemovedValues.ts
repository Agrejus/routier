import { PropertyInfo, SchemaTypes } from "@routier/core/schema";

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null;

const holdsStoredValue = (property: PropertyInfo<{}>) => property.type !== SchemaTypes.Computed && property.type !== SchemaTypes.Function;

export const clearRemovedValues = (destination: Fields, source: Fields, properties: PropertyInfo<{}>[]): void => {
    for (const property of properties.filter(holdsStoredValue)) {
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
