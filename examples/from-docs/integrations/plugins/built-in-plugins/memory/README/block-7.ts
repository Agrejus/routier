import { MemoryPlugin } from "@routier/memory-plugin";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";
import { DbPluginReplicator } from "@routier/core/plugins";

const memoryPlugin = new MemoryPlugin("offline");
const pouchDbPlugin = new PouchDbPlugin("remote");

const replicationPlugin = DbPluginReplicator.create({
  replicas: [memoryPlugin],
  source: pouchDbPlugin,
  read: memoryPlugin,
});