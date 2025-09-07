const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      // Detailed debug logging
      console.group("PouchDB Sync Event");
      console.log("Direction:", change.direction);
      console.log("Change:", change.change);
      console.log("Schemas:", schemas);
      console.log("Timestamp:", new Date().toISOString());
      console.groupEnd();
    },
  },
});