import { SchemaArray } from "./property/types/SchemaArray";
import { SchemaBase } from "./property/base/SchemaBase";
import { SchemaBoolean } from "./property/types/SchemaBoolean";
import { SchemaDate } from "./property/types/SchemaDate";
import { SchemaDefinition } from "./SchemaDefinition";
import { SchemaNumber } from "./property/types/SchemaNumber";
import { SchemaObject } from "./property/types/SchemaObject";
import { SchemaFile } from "./property/types/SchemaFile";
import { SchemaString } from "./property/types/SchemaString";
import { SchemaVector } from "./property/types/SchemaVector";
import { CollectionName, FileReferenceValue, StringOptions, VectorValue } from "./types";

/**
 * A string, optionally declaring how long it can be and which values it may take.
 *
 * ```ts
 * s.string()                              // any string
 * s.string("draft", "published")          // a literal union
 * s.string({ maxLength: 4000 })           // any string, declared long
 * s.string({ maxLength: 8 }, "a", "b")    // both
 * ```
 *
 * The options object is a leading parameter rather than a `.maxLength()` modifier so the
 * declaration stays on the factory, next to the literals. A modifier would also have to survive
 * being wrapped by another modifier, which is the trap `SchemaBase.maxLength` documents.
 */
function string<T extends string[] = string[]>(...literals: T): SchemaString<T[number] extends never ? string : T[number], never>;
function string<T extends string[] = string[]>(options: StringOptions, ...literals: T): SchemaString<T[number] extends never ? string : T[number], never>;
function string(optionsOrLiteral?: StringOptions | string, ...rest: string[]) {

    // A literal is a string and options is an object, so the first argument decides which
    // overload was called. Nothing else can be passed, which is why this needs no flag and no
    // second factory.
    if (typeof optionsOrLiteral === "string") {
        return new SchemaString<string, never>(null, [optionsOrLiteral, ...rest]);
    }

    if (optionsOrLiteral == null) {
        return new SchemaString<string, never>(null, []);
    }

    return new SchemaString<string, never>(null, rest, optionsOrLiteral);
}

export const s = {
    number: <T extends number[] = number[]>(...literals: T) => new SchemaNumber<T[number] extends never ? number : T[number], never>(null, literals),
    string,
    boolean: <T extends boolean = boolean>() => new SchemaBoolean<T, never>(),
    date: <T extends Date = Date>() => new SchemaDate<T, never>(),
    array: <T extends any>(schema: SchemaBase<T, never>) => new SchemaArray<SchemaBase<T, never>, never>(schema as any),
    object: <T extends {} = {}>(schema: T) => new SchemaObject<T, never>(schema),
    /**
     * A file. Assign content, read back a reference.
     *
     * Needs `@routier/blob-plugin` wrapping your plugin to turn the one into the other; core
     * only carries the value through untouched.
     */
    file: () => new SchemaFile<FileReferenceValue, never>(),
    /**
     * An embedding of `dimensions` numbers, searchable with `.nearest()`.
     *
     * Every backend supports it. One with a native vector column uses it; the rest store the
     * numbers as JSON and score the search in memory, which returns the same rows.
     */
    vector: (dimensions: number) => new SchemaVector<VectorValue, never>(dimensions),
    define: <T extends {}>(collectionName: string, schema: T) => new SchemaDefinition<T>(collectionName as CollectionName, schema),
}