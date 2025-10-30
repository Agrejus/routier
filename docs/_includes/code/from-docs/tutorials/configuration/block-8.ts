import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const isDevelopment = process.env.NODE_ENV === "development";
const plugin = isDevelopment ? new MemoryPlugin("dev-app") : new PouchDbPlugin("prod-database");


class MyContext extends DataStore {
  constructor() {
    super(plugin);
  }
}