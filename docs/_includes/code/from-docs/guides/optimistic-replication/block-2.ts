import { OptimisticReplicationDbPlugin } from "@routier/core/plugins/replication";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DexiePlugin } from "@routier/dexie-plugin";
import { DataStore } from "@routier/datastore";

// Create the optimistic replication plugin
const plugin = new OptimisticReplicationDbPlugin({
  read: new MemoryPlugin("optimistic-memory"),
  source: new DexiePlugin("optimistic-db"),
  replicas: [], // Add more replica plugins if needed
});

// Create your DataStore
export class AppDataStore extends DataStore {
  constructor() {
    super(plugin);
  }

  // Define your collections
  vehicles = this.collection(vehicleSchema).proxy().create();
  tasks = this.collection(taskSchema).proxy().create();
}

export const ctx = new AppDataStore();