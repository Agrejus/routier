import { s, SchemaTypes } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

const SALT = "sealed";

const sealed = {
  to: (value: string) => `${SALT}:${Array.from(value).reverse().join("")}`,
  from: (stored: string | number | boolean | null | undefined | object) =>
    Array.from(String(stored).slice(SALT.length + 1)).reverse().join(""),
  stores: SchemaTypes.String,
};

const profileFields = {
  id: s.string().key().identity(),
  name: s.string(),
  joinedAt: s.date(),
  address: s.object({ city: s.string(), zip: s.string() }),
  tags: s.array(s.string()),
  secret: s.string(),
};

const profileSchema = s.define("profiles", profileFields)
  .modify((x) => ({ secret: x.transform(sealed) }))
  .compile();

const rawProfileSchema = s.define("profiles", profileFields).compile();

export class ProfileStore extends DataStore {
  profiles = this.collection(profileSchema).proxy().create();
}

export class RawProfileStore extends DataStore {
  profiles = this.collection(rawProfileSchema).proxy().create();
}

let databaseId = 0;
const created: DataStore[] = [];

export function createProfileStores(): { store: ProfileStore; raw: RawProfileStore } {
  databaseId++;
  const plugin = new MemoryPlugin(`devtools-profiles-${databaseId}`);
  const store = new ProfileStore(plugin);
  const raw = new RawProfileStore(plugin);
  created.push(store, raw);
  return { store, raw };
}

export async function addProfile(store: ProfileStore, name: string): Promise<void> {
  await store.profiles.addAsync({
    name,
    joinedAt: new Date("2024-03-01T12:00:00.000Z"),
    address: { city: "Lisbon", zip: "1100" },
    tags: ["admin", "beta"],
    secret: "hunter2",
  });
  await store.saveChangesAsync();
}

export function disposeProfileStores(): void {
  for (const store of created.splice(0)) store[Symbol.dispose]();
}
