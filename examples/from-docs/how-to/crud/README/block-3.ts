import { MemoryPlugin } from "routier-plugin-memory";
import { DexiePlugin } from "routier-plugin-dexie";
import { PouchDbPlugin } from "routier-plugin-pouchdb";

// Memory (fastest, no persistence)
class MemoryContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }
  users = this.collection(userSchema).proxy().create();
}

// Dexie (IndexedDB, browser persistence)
class DexieContext extends DataStore {
  constructor() {
    super(new DexiePlugin("my-database"));
  }
  users = this.collection(userSchema).proxy().create();
}

// PouchDB (sync-capable)
class PouchContext extends DataStore {
  constructor() {
    super(new PouchDbPlugin("my-sync-db"));
  }
  users = this.collection(userSchema).proxy().create();
}