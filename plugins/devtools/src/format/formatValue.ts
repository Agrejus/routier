import type { InspectedValue } from "@routier/datastore";
import { describeLeaf } from "./leaves";
import { formatPrimitive, isPrimitive } from "./primitives";

const INDENT = "  ";
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

type Entry = readonly [prefix: string, value: InspectedValue];

interface Container {
  readonly open: string;
  readonly close: string;
  readonly entries: ReadonlyArray<Entry>;
}

function propertyLabel(key: string): string {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

function unlabelled(items: Iterable<InspectedValue>): ReadonlyArray<Entry> {
  return Array.from(items, (item): Entry => ["", item]);
}

function containerOf(value: object, format: (value: InspectedValue) => string): Container {
  if (value instanceof Map) {
    const entries = Array.from(value, ([key, item]): Entry => [`${format(key)} => `, item]);
    return { open: `Map(${value.size}) {`, close: "}", entries };
  }
  if (value instanceof Set) return { open: `Set(${value.size}) {`, close: "}", entries: unlabelled(value) };
  if (Array.isArray(value)) return { open: "[", close: "]", entries: unlabelled(value) };
  const entries = Object.entries(value).map(([key, item]): Entry => [`${propertyLabel(key)}: `, item]);
  return { open: "{", close: "}", entries };
}

function format(value: InspectedValue, indent: string, ancestors: WeakSet<object>): string {
  if (isPrimitive(value)) return formatPrimitive(value);
  if (ancestors.has(value)) return "[Circular]";
  const leaf = describeLeaf(value);
  if (leaf !== null) return leaf;

  ancestors.add(value);
  const inner = indent + INDENT;
  const { open, close, entries } = containerOf(value, (key) => format(key, inner, ancestors));
  const lines = entries.map(([prefix, item]) => `${inner}${prefix}${format(item, inner, ancestors)}`);
  ancestors.delete(value);

  return lines.length === 0 ? `${open}${close}` : `${open}\n${lines.join(",\n")}\n${indent}${close}`;
}

export function formatValue(value: InspectedValue): string {
  return format(value, "", new WeakSet());
}
