import { MemoryPlugin } from "@routier/memory-plugin";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";
import { ReplicationDbPlugin } from "@routier/core/plugins";

const memoryPlugin = new MemoryPlugin("offline");
const pouchDbPlugin = new PouchDbPlugin("remote");

const replicationPlugin = new ReplicationDbPlugin({
  replicas: [memoryPlugin],
  source: pouchDbPlugin,
  read: memoryPlugin,
});