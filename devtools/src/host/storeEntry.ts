import type { StoreInspection } from "@routier/datastore";

export interface StoreEntry {
  readonly label: string;
  readonly inspection: StoreInspection;
}

export function uniqueLabel(base: string, taken: ReadonlyArray<string>): string {
  if (!taken.includes(base)) return base;
  let suffix = 2;
  while (taken.includes(`${base} (${suffix})`)) suffix++;
  return `${base} (${suffix})`;
}
