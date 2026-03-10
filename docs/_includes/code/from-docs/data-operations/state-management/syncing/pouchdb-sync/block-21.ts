import { DataStore } from "@routier/datastore";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://127.0.0.1:5984/myapp",
    live: true,
    retry: true,
  },
});

class AppDataStore extends DataStore {
  constructor() {
    super(plugin);
  }
}

const store = new AppDataStore();

// Start sync
plugin.sync(store.schemas);