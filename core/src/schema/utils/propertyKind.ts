import { SchemaTypes } from "../types";

/**
 * Types whose runtime value is a JS array.
 *
 * `Array` and `Vector` are the same thing to every layer that copies, compares, hashes or
 * freezes a value — a vector is a list of numbers and nothing more. They differ only where a
 * backend chooses storage, which is the one place that should ask for `SchemaTypes.Vector` by
 * name.
 *
 * This exists so adding a third array-shaped type is one edit rather than a hunt through
 * twelve handlers. Missing one of those is silent in the worst way: a vector that clones by
 * reference is shared with the change tracker's copy, so overwriting an embedding produces no
 * diff and the save reports nothing to do.
 */
const ARRAY_VALUED_TYPES = new Set<SchemaTypes>([
    SchemaTypes.Array,
    SchemaTypes.Vector,
]);

/** True when the property's value is a JS array and needs value rather than reference semantics. */
export const isArrayValued = (type: SchemaTypes) => ARRAY_VALUED_TYPES.has(type);

/**
 * True when the property's elements are primitives, so a spread is a sufficient copy.
 *
 * A vector is always numbers, so it never needs the per-element deep copy an array of objects
 * or dates does.
 */
const PRIMITIVE_ELEMENT_TYPES = new Set<SchemaTypes | undefined>([
    SchemaTypes.String,
    SchemaTypes.Number,
    SchemaTypes.Boolean,
]);

export const hasPrimitiveElements = (type: SchemaTypes, elementType: SchemaTypes | undefined) =>
    type === SchemaTypes.Vector || PRIMITIVE_ELEMENT_TYPES.has(elementType);
