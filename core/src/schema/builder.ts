import { SchemaArray } from "./property/types/SchemaArray";
import { SchemaBase } from "./property/base/SchemaBase";
import { SchemaBoolean } from "./property/types/SchemaBoolean";
import { SchemaDate } from "./property/types/SchemaDate";
import { SchemaDefinition } from "./SchemaDefinition";
import { SchemaNumber } from "./property/types/SchemaNumber";
import { SchemaObject } from "./property/types/SchemaObject";
import { SchemaString } from "./property/types/SchemaString";

export const s = {
    number: <T extends number[] = number[]>(...literals: T) => new SchemaNumber<T[number] extends never ? number : T[number], never>(null, literals),
    string: <T extends string[] = string[]>(...literals: T) => new SchemaString<T[number] extends never ? string : T[number], never>(null, literals),
    boolean: <T extends boolean = boolean>() => new SchemaBoolean<T, never>(),
    date: <T extends Date = Date>() => new SchemaDate<T, never>(),
    array: <T extends any>(schema: SchemaBase<T, never>) => new SchemaArray<SchemaBase<T, never>, never>(schema as any),
    object: <T extends {} = {}>(schema: T) => new SchemaObject<T, never>(schema),
    define: <T extends {}>(collectionName: string, schema: T) => new SchemaDefinition<T>(collectionName, schema)
}