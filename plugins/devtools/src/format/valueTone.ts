import type { InspectedValue } from "@routier/datastore";

export type ValueTone = "string" | "number" | "boolean" | "empty" | "date" | "complex";

export function toneOf(value: InspectedValue): ValueTone {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string") return "string";
  if (typeof value === "number" || typeof value === "bigint") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return "date";
  return "complex";
}
