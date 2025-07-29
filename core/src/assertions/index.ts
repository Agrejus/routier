import { ChangePackage } from "../collections/Changes";
import { DbPluginLogging } from "../plugins/logging/DbPluginLogging";
import { InferCreateType, InferType } from "../schema/types";
import { DeepPartial } from "../types";
import { isDate } from "@core/utilities";

export function assertDate(data: unknown): asserts data is Date {
    if (isDate(data) === false) {
        throw new TypeError('Value is not a Date');
    }
}

export function assertIsNotNull<T>(data: T | null | undefined, message?: string): asserts data is NonNullable<T> {
    if (data == null) {
        throw new TypeError(message ?? 'Assertion failed, data is null');
    }
}

export function assertIsArray<T>(data: unknown, message?: string): asserts data is T[] {
    if (!Array.isArray(data)) {
        throw new TypeError(message ?? 'Assertion failed, data is not of type Array');
    }
}

export function assertString(data: unknown, message?: string): asserts data is string {
    if (typeof data !== "string") {
        throw new TypeError(message ?? 'Assertion failed, data is not of type String');
    }
}

export function assertInstanceOf<T extends new (...args: any[]) => any>(value: unknown, Instance: T): asserts value is T {
    if (value instanceof Instance) {
        return;
    }

    if (value != null && typeof value === "object" && "constructor" in value) {
        throw new TypeError(`Value is not instance of type.  Type: ${value.constructor.name}`);
    }

    throw new TypeError(`Value is not instance of type`);
}

export function assertInstanceOfDbPluginLogging(value: unknown): asserts value is DbPluginLogging {
    if (value instanceof DbPluginLogging) {
        return;
    }

    throw new TypeError(`Value is not instance of DbPluginLogging`);
}

export function assertChangePackageIsEntity<T extends {}>(data: ChangePackage<T>, message?: string): asserts data is {
    entity: InferType<T> | InferCreateType<T> | DeepPartial<InferCreateType<T>>;
} {
    if (!("entity" in data)) {
        throw new TypeError(message ?? 'Assertion failed, wrong type');
    }
}