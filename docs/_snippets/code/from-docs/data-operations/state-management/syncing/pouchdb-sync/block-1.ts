import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://127.0.0.1:5984/myapp",
  },
});