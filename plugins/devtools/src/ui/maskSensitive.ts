import type { InspectedRow, InspectedValue } from "@routier/datastore";
import type { LivePage } from "../live/useLivePage";

export const MASK = "••••••";

const isRecord = (value: InspectedValue): value is Readonly<Record<string, InspectedValue>> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

function maskPath(row: InspectedRow, [name, ...rest]: string[]): InspectedRow {
  const value = row[name];
  if (value == null) return row;
  if (rest.length === 0) return { ...row, [name]: MASK };
  return isRecord(value) ? { ...row, [name]: maskPath(value, rest) } : row;
}

export function maskRow(row: InspectedRow, paths: ReadonlyArray<string>): InspectedRow {
  return paths.reduce((masked, path) => maskPath(masked, path.split(".")), row);
}

export function maskPage(page: LivePage, paths: ReadonlyArray<string>): LivePage {
  if (page.status !== "success" || paths.length === 0) return page;
  return { status: "success", value: page.value.map((row) => maskRow(row, paths)) };
}
