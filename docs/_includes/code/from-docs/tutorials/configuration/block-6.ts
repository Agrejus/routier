import { DbPluginLogging, DbPluginReplicator } from "routier-core/plugins";

// Add logging to any plugin
const memoryPluginWithLogging = DbPluginLogging.create(memoryPlugin);

// Create replication between plugins
const replicationPlugin = DbPluginReplicator.create({
  replicas: [memoryPluginWithLogging],
  source: pouchDbPluginWithLogging,
  read: memoryPluginWithLogging,
});