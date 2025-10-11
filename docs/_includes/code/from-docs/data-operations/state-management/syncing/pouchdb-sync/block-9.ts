import { DataStore } from "@routier/datastore";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";
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

// Create the data store class
class AppDataStore extends DataStore {
  constructor() {
    super(plugin);
  }

  products = this.collection(productSchema).create();
}

const dataStore = new AppDataStore();

// All operations now automatically sync
await dataStore.products.addAsync({
  name: "New Product",
  price: 99.99,
  category: "electronics",
});

// Save changes (triggers sync)
await dataStore.saveChangesAsync();