import { formatPrimitive } from "./primitives";

const MAX_BINARY_ITEMS = 64;

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

function isTypedArray(value: object): value is TypedArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function formatDate(value: Date): string {
  return Number.isNaN(value.getTime()) ? "Date(Invalid Date)" : `Date(${value.toISOString()})`;
}

function formatTypedArray(value: TypedArray): string {
  const shown = Array.from<number | bigint, string>(value.slice(0, MAX_BINARY_ITEMS), formatPrimitive);
  const hidden = value.length - shown.length;
  const items = hidden > 0 ? [...shown, `… ${hidden} more`] : shown;
  return `${value.constructor.name}(${value.length}) [${items.join(", ")}]`;
}

function formatBlob(value: Blob): string {
  const type = value.type === "" ? "" : `, ${value.type}`;
  return `${value.constructor.name}(${value.size} bytes${type})`;
}

function formatFunction(value: Function): string {
  return value.name === "" ? "[Function]" : `[Function ${value.name}]`;
}

export function describeLeaf(value: object): string | null {
  if (value instanceof Date) return formatDate(value);
  if (value instanceof ArrayBuffer) return `ArrayBuffer(${value.byteLength} bytes)`;
  if (value instanceof DataView) return `DataView(${value.byteLength} bytes)`;
  if (isTypedArray(value)) return formatTypedArray(value);
  if (value instanceof Blob) return formatBlob(value);
  if (value instanceof RegExp) return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "function") return formatFunction(value);
  return null;
}
