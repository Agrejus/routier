import type { InspectedRow } from "@routier/datastore";

export function columnsOf(rows: ReadonlyArray<InspectedRow>): ReadonlyArray<string> {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return [...columns];
}
