import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { ReplicationDbPlugin } from "@routier/core/plugins";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

// Combine with replication for offline capabilities
const memoryPlugin = new MemoryPlugin("offline");
const pouchDbPlugin = new PouchDbPlugin("remote");

const replicationPlugin = ReplicationDbPlugin.create({
  replicas: [memoryPlugin],
  source: pouchDbPlugin,
  read: memoryPlugin,
});

class AppContext extends DataStore {
  constructor() {
    super(replicationPlugin);
  }

  // Your Collections Here
}