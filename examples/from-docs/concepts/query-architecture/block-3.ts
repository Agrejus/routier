// This exact same query works across all storage backends
const query = dataStore.products
  .where((p) => p.price > 50 && p.category === "electronics")
  .sort((p) => p.price)
  .take(20);

// Works with SQLite
const sqliteResults = await query.toArrayAsync();

// Works with IndexedDB (Dexie)
const dexieResults = await query.toArrayAsync();

// Works with PouchDB
const pouchResults = await query.toArrayAsync();

// Works with in-memory storage
const memoryResults = await query.toArrayAsync();