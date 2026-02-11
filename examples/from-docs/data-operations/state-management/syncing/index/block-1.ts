import PouchDB from "pouchdb";
import express from "express";
import expressPouchDB from "express-pouchdb";
import cors from "cors";

const app = express();

// Enable CORS for browser connections
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Mount PouchDB at root
app.use(expressPouchDB(PouchDB));

app.listen(5984, () => {
  console.log("CouchDB server running on http://127.0.0.1:5984");
});