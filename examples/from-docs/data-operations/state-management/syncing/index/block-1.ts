import { PouchDbPlugin } from "routier-plugin-pouchdb";

const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp", // Remote database URL
    live: true, // Enable live synchronization
    retry: true, // Automatically retry failed syncs
    onChange: (schemas, change) => {
      // Handle sync events
      console.log("Sync change:", change);
      // Handle schema updates, conflicts, etc.
    },
  },
});