import { DataStore } from "@routier/datastore";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";
import { productSchema } from "./schemas/product";

// Configure the plugin with syncing
const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      console.log("Sync event:", {
        direction: change.direction,
        changeCount: change.change?.docs?.length || 0,
        timestamp: new Date().toISOString(),
      });
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

// Now all operations automatically sync
await dataStore.products.addAsync({
  name: "New Product",
  price: 99.99,
});

// This will automatically sync to the remote server
await dataStore.saveChangesAsync();