// Start with in-memory for development
const dataStore = new DataStore(new MemoryPlugin("dev"));

// Later switch to SQLite for production
const dataStore = new DataStore(new SqlitePlugin("production.db"));

// All your queries remain unchanged
const products = await dataStore.products
  .where((p) => p.inStock === true)
  .toArrayAsync();