---
title: Query Architecture
layout: default
parent: Concepts
nav_order: 1
permalink: /concepts/query-architecture/
---

# Query Architecture

Routier's query architecture enables you to write plain JavaScript queries that work across any datastore. This page explains how Routier transforms natural JavaScript expressions into datastore-agnostic queries.

## Quick Navigation

- [Plain JavaScript Queries](#plain-javascript-queries)
- [Expression Tree Architecture](#expression-tree-architecture)
- [Plugin Translation](#plugin-translation)
- [Cross-Platform Benefits](#cross-platform-benefits)
- [Performance Considerations](#performance-considerations)
- [Related Topics](#related-topics)

## Plain JavaScript Queries

Routier allows you to write queries using familiar JavaScript syntax:

```ts
// Simple filtering
const expensiveProducts = await dataStore.products
  .where((p) => p.price > 100)
  .toArrayAsync();

// Complex queries with multiple conditions
const electronicsInStock = await dataStore.products
  .where((p) => p.category === "electronics" && p.inStock === true)
  .sort((p) => p.price)
  .take(10)
  .toArrayAsync();

// String operations
const laptopProducts = await dataStore.products
  .where((p) => p.name.toLowerCase().includes("laptop"))
  .toArrayAsync();
```

These queries work identically regardless of whether you're using SQLite, IndexedDB, PouchDB, or in-memory storage.

## Expression Tree Architecture

Routier transforms JavaScript queries into agnostic expressions that plugins can translate into any query language. This architecture, inspired by [.NET Expression Trees](https://docs.microsoft.com/en-us/dotnet/csharp/expression-trees), enables powerful cross-platform querying.

### How Expression Trees Work

Expression trees represent code as data structures rather than executable code. In Routier, when you write:

```ts
dataStore.products.where((p) => p.price > 100 && p.category === "electronics");
```

Routier parses this into an abstract syntax tree (AST) that represents the logical structure:

```
OperatorExpression (&&)
├── left: ComparatorExpression (greater-than)
│   ├── left: PropertyExpression (p.price)
│   └── right: ValueExpression (100)
└── right: ComparatorExpression (equals)
    ├── left: PropertyExpression (p.category)
    └── right: ValueExpression ("electronics")
```

This tree structure allows Routier to:

- **Convert** JavaScript expressions into a standardized AST format
- **Pass** the AST to plugins for translation into native query languages

## Plugin Translation

Each storage plugin receives these ASTs and translates them into their native query language:

- **SQLite Plugin**: Converts `OperatorExpression` to SQL `AND`/`OR`, `ComparatorExpression` to SQL operators (`=`, `>`, `LIKE`, etc.)
- **Dexie Plugin**: Uses IndexedDB's native filtering with JavaScript functions
- **PouchDB Plugin**: Translates to PouchDB query functions and map/reduce operations
- **Memory Plugin**: Optimizes for in-memory filtering with direct JavaScript evaluation

### Query Languages vs Storage Technologies

**Query Languages** are structured syntaxes that databases interpret to perform queries:

- **SQL**: `SELECT id, name, price, category FROM products WHERE price > 100 AND category = 'electronics'`
- **MongoDB Mango**: `{"$and": [{"price": {"$gt": 100}}, {"category": "electronics"}]}`
- **MQL (MongoDB Query Language)**: `db.products.find({price: {$gt: 100}, category: "electronics"})`
- **Lucene**: `price:[100 TO *] AND category:electronics`
- **Firestore**: `collection('products').where('price', '>', 100).where('category', '==', 'electronics')`
- **CouchDB Selector**: `{"selector": {"price": {"$gt": 100}, "category": "electronics"}}`

**Storage Technologies** are the underlying data storage systems:

- **SQLite**: Uses SQL query language
- **PostgreSQL**: Uses SQL query language
- **MongoDB**: Uses MQL and Mango query languages
- **IndexedDB**: Uses JavaScript-based filtering (not a query language)
- **PouchDB**: Uses CouchDB selector syntax and map/reduce functions
- **Firestore**: Uses Firestore query language

This abstraction means you can write the same query syntax regardless of your underlying storage technology.

## Cross-Platform Benefits

### Write Once, Run Anywhere

```ts
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
```

### Seamless Migration

You can switch storage backends without changing your query code:

```ts
// Start with in-memory for development
const dataStore = new DataStore(new MemoryPlugin("dev"));

// Later switch to SQLite for production
const dataStore = new DataStore(new SqlitePlugin("production.db"));

// All your queries remain unchanged
const products = await dataStore.products
  .where((p) => p.inStock === true)
  .toArrayAsync();
```

## Performance Considerations

### Database-Level Optimization

When Routier can parse your JavaScript expressions, it translates them to optimized database queries:

```ts
// This gets translated to: SELECT id, name, price, category FROM products WHERE price > 100 AND category = 'electronics'
const optimized = await dataStore.products
  .where((p) => p.price > 100 && p.category === "electronics")
  .toArrayAsync();
```

### Fallback Behavior

When expressions cannot be parsed (returns `NOT_PARSABLE`), Routier falls back to selecting all data and filtering in memory:

```ts
// Complex expression that can't be parsed - falls back to memory filtering
const complex = await dataStore.products
  .where((p) => someComplexFunction(p) === true)
  .toArrayAsync();
```

**Best Practice**: Use parameterized queries and avoid complex expressions that cannot be parsed to maintain optimal performance.

### Parameterized Queries

For dynamic filtering with variables, use parameterized queries to ensure database-level optimization:

```ts
const minPrice = 100;
const category = "electronics";

// ✅ Optimized - translated to database query
const optimized = await dataStore.products
  .where(
    ([p, params]) =>
      p.price >= params.minPrice && p.category === params.category,
    { minPrice, category }
  )
  .toArrayAsync();

// ⚠️ Falls back to memory filtering
const fallback = await dataStore.products
  .where((p) => p.price >= minPrice && p.category === category)
  .toArrayAsync();
```

## Related Topics

- [Filtering Data](/concepts/queries/filtering/) - Learn how to filter your data
- [Sorting Results](/concepts/queries/sorting/) - Learn how to sort query results
- [Field Selection](/concepts/queries/field-selection/) - Learn how to select specific fields
- [Pagination](/concepts/queries/pagination/) - Learn how to paginate results
- [Aggregation](/concepts/queries/aggregation/) - Learn how to perform calculations
- [Terminal Methods](/concepts/queries/terminal-methods/) - Learn about query execution methods
