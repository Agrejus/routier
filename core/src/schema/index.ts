import { SchemaArray } from "./property/types/Array";
import { SchemaBase } from "./property/base/Base";
import { SchemaBoolean } from "./property/types/Boolean";
import { SchemaDate } from "./property/types/Date";
import { SchemaDefinition } from "./Definition";
import { SchemaNumber } from "./property/types/Number";
import { SchemaObject } from "./property/types/Object";
import { SchemaString } from "./property/types/String";

export const s = {
    number: <T extends number[] = number[]>(...literals: T) => new SchemaNumber<T[number] extends never ? number : T[number], never>(null, literals),
    string: <T extends string[] = string[]>(...literals: T) => new SchemaString<T[number] extends never ? string : T[number], never>(null, literals),
    boolean: <T extends boolean = boolean>() => new SchemaBoolean<T, never>(),
    date: <T extends Date = Date>() => new SchemaDate<T, never>(),
    array: <T extends any>(schema: SchemaBase<T, never>) => new SchemaArray<SchemaBase<T, never>, never>(schema as any),
    object: <T extends {} = {}>(schema: T) => new SchemaObject<T, never>(schema),
    define: <T extends {}>(collectionName: string, schema: T) => new SchemaDefinition<T>(collectionName, schema)
}

export { SchemaArray } from "./property/types/Array";
export { SchemaBase } from "./property/base/Base";
export { SchemaBoolean } from "./property/types/Boolean";
export { SchemaDate } from "./property/types/Date";
export { SchemaDefinition } from "./Definition";
export { SchemaNumber } from "./property/types/Number";
export { SchemaObject } from "./property/types/Object";
export { SchemaString } from "./property/types/String";
export { SchemaKey } from "./property/modifiers/Key";
export { SchemaReadonly } from "./property/modifiers/Readonly";
export { SchemaIdentity } from "./property/modifiers/Identity";

export * from './PropertyInfo';
export * from './types';