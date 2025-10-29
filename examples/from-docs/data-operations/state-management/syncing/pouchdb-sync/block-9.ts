import { DataStore } from "@routier/datastore";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";
import { s } from "@routier/core/schema";
import { UnknownRecord } from "@routier/core";
import { SchemaCollection } from "@routier/core/collections";

// Define schemas
const itemSchema = s
  .define("item", {
    id: s.string().key().identity(),
    name: s.string(),
    description: s.string(),
    createdAt: s.date(),
  })
  .compile();

const categorySchema = s
  .define("category", {
    id: s.string().key().identity(),
    name: s.string(),
    description: s.string(),
  })
  .compile();

// Configure PouchDB with pull-only sync and filtering
const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://127.0.0.1:5984/myapp",
    pull: {
      live: true,
      retry: true,

      // Optional
      filter: (doc) => {
        // Only sync documents from specific collections
        return doc.collectionName === "item" || doc.collectionName === "category";
      },
    },
    push: false as any, // Pull-only sync
    onChange: (schemas: SchemaCollection, change: any) => {
      if (change.direction !== "pull" || !change.change.docs) return;

      // Group documents by collection
      const docsByCollection = change.change.docs.reduce(
        (acc: { [key: string]: UnknownRecord[] }, doc: UnknownRecord) => {
          const name = doc.collectionName as string;
          if (name) (acc[name] ??= []).push(doc);
          return acc;
        },
        {} as { [key: string]: UnknownRecord[] }
      );

      // Process each collection
      for (const [name, docs] of Object.entries(docsByCollection)) {
        const schema = schemas.getByName(name);
        if (!schema) continue;

        const subscription = schema.createSubscription();
        subscription.send({ adds: [], removals: [], updates: [], unknown: docs });
        subscription[Symbol.dispose]();
      }
    },
  },
});

// Create DataStore with plugin
class AppDataStore extends DataStore {
  items = this.collection(itemSchema).create();
  categories = this.collection(categorySchema).create();

  constructor() {
    super(plugin);
  }
}

const ctx = new AppDataStore();

// Sync starts automatically when plugin is created
// Remote changes will be pulled automatically based on the filter