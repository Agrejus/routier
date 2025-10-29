import { ReplicationDbPlugin } from "@routier/core/plugins";
import { MemoryPlugin } from "@routier/memory-plugin";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

// Create base plugins
const memoryPlugin = new MemoryPlugin("offline");
const pouchDbPlugin = new PouchDbPlugin("remote");

// Create replication between plugins
const replicationPlugin = ReplicationDbPlugin.create({
  replicas: [memoryPlugin],
  source: pouchDbPlugin,
  read: memoryPlugin,
});