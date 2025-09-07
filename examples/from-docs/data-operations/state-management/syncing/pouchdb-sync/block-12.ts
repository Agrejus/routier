const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      console.log("Primary sync:", change);
    },
  },
});

// Add additional sync connections
const additionalSync = localDb.sync("http://backup-server:3000/myapp", {
  live: true,
  retry: true,
});