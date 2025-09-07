// Check sync status
console.log("Plugin options:", plugin._options);

// Check database connection
const db = new PouchDB("myapp");
db.info().then((info) => console.log("DB info:", info));

// Check remote connection
const remoteDb = new PouchDB("http://localhost:3000/myapp");
remoteDb.info().then((info) => console.log("Remote DB info:", info));