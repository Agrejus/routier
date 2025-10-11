import { MemoryPlugin } from "@routier/memory-plugin";
import { DexiePlugin } from "@routier/dexie-plugin";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

// Memory (fastest, no persistence)
class MemoryContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }
  users = this.collection(userSchema).create();
}

// Dexie (IndexedDB, browser persistence)
class DexieContext extends DataStore {
  constructor() {
    super(new DexiePlugin("my-database"));
  }
  users = this.collection(userSchema).create();
}

// PouchDB (sync-capable)
class PouchContext extends DataStore {
  constructor() {
    super(new PouchDbPlugin("my-sync-db"));
  }
  users = this.collection(userSchema).create();
}