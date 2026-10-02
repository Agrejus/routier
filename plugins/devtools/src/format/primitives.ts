import type { InspectedValue } from "@routier/datastore";

export type Primitive = Exclude<InspectedValue, object> | null;

export function isPrimitive(value: InspectedValue): value is Primitive {
  return value === null || (typeof value !== "object" && typeof value !== "function");
}

export function formatPrimitive(value: Primitive): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "bigint":
      return `${value}n`;
    default:
      return String(value);
  }
}
