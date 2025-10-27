import { DataStore } from "routier";
import { PouchDbPlugin } from "routier-plugin-pouchdb";
import { productSchema } from "./schemas/product";

// Configure PouchDB with syncing
const plugin = new PouchDbPlugin("myapp", {
  // Database configuration
  name: "myapp",

  // Sync configuration
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      // Handle sync events
      if (change.direction === "push") {
        console.log("Local changes pushed to remote");
      } else if (change.direction === "pull") {
        console.log("Remote changes pulled to local");
      }

      // Log document changes
      if (change.change && change.change.docs) {
        change.change.docs.forEach((doc) => {
          console.log(`Document ${doc.id} synced`);
        });
      }
    },
  },
});

// Create the data store
const dataStore = new DataStore(plugin);

// Add collections
const products = dataStore.collection(productSchema).create();

// All operations now automatically sync
await products.addAsync({
  name: "New Product",
  price: 99.99,
  category: "electronics",
});

// Save changes (triggers sync)
await dataStore.saveChangesAsync();