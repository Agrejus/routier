import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Combine with replication for offline capabilities
const memoryPlugin = new MemoryPlugin("offline");
const pouchDbPlugin = new PouchDbPlugin("remote");

const replicationPlugin = DbPluginReplicator.create({
  replicas: [memoryPlugin],
  source: pouchDbPlugin,
  read: memoryPlugin,
});