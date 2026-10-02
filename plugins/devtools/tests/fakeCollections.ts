import { s } from "@routier/core/schema";
import type { InspectedCollection, StoreInspection } from "@routier/datastore";
import type { InspectableStore } from "@routier/devtools";

let fakeId = 0;

export function fakeCollection(name: string, overrides: Partial<InspectedCollection> = {}): InspectedCollection {
  fakeId++;
  const schema = s.define(`fake-${fakeId}`, { id: s.string().key() }).compile();
  return {
    name,
    schemaId: schema.id,
    kind: "collection",
    count: () => new Promise<number>(() => undefined),
    keyOf: (row) => String(row.id),
    watchCount: () => () => undefined,
    watchPage: () => () => undefined,
    ...overrides,
  };
}

export function fakeStore(...collections: InspectedCollection[]): InspectableStore {
  const inspection: StoreInspection = {
    plugin: { name: "FakePlugin", databaseName: "fake-db" },
    collections,
    disposed: new AbortController().signal,
    watchQueries: () => () => undefined,
  };
  return { inspect: () => inspection };
}
