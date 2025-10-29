import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      console.log("Sync event:", change);
    },
  },
});