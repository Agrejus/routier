import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const isDevelopment = process.env.NODE_ENV === "development";

class DevContext extends DataStore {
  constructor() {
    if (isDevelopment) {
      super(new MemoryPlugin("dev-app"));
    } else {
      super(new PouchDbPlugin("prod-database"));
    }
  }
}