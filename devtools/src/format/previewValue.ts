import type { InspectedValue } from "@routier/datastore";
import { describeLeaf } from "./leaves";
import { formatPrimitive, isPrimitive } from "./primitives";

function previewContainer(value: object): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  return "{…}";
}

export function previewValue(value: InspectedValue): string {
  if (typeof value === "string") return value;
  if (isPrimitive(value)) return formatPrimitive(value);
  return describeLeaf(value) ?? previewContainer(value);
}
