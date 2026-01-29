# Routier Type Safety Rules

## Core Principles

1. **Never use `any` or `unknown` casts** - Always rely on Routier's type inference
2. **Use schema methods for type-safe operations** - Schemas provide type-safe methods
3. **Leverage `InferType` and `InferCreateType`** - These are the primary type utilities
4. **Trust the type system** - Routier's types are designed to be type-safe without casts

## Type Inference from Schemas

### Compiled Schema Types
- `CompiledSchema<T>` provides type information for entity `T`
- Use schema methods that return properly typed values:
  - `schema.prepare(data)` - Returns `InferCreateType<T>` with proper defaults/transformations
  - `schema.hash(entity, HashType)` - Works with `InferType<T>` or `InferCreateType<T>`
  - `schema.getId(entity)` - Returns `IdType` from `InferType<T>`

## Creating Collections

### Use `collection().create()` for Type Inference
**Always use `this.collection(schema).create()` instead of constructors** - This allows Routier to properly infer types from the schema.

```typescript
// ✅ CORRECT: Use collection().create() for proper type inference
private metadataCollection = this.collection(metadataSchema).create();
private queueCollection = this.collection(queueSchema).create();

// The collection type is automatically inferred from the schema
// metadataCollection is Collection<SyncMetadata>
// queueCollection is Collection<PendingChange>

// ❌ WRONG: Don't use constructors directly
private metadataCollection = new Collection(metadataSchema, ...);
// This loses type inference and requires manual type annotations
```

### Why This Matters
- **Automatic type inference** - TypeScript infers `Collection<T>` from the schema
- **Type safety** - All collection methods are properly typed
- **No manual annotations needed** - No need for `as Collection<Type>` casts
- **Consistent with Routier patterns** - This is the standard way to create collections

## Working with BulkPersistChanges

### Resolving Schema Changes
- `bulkChanges.resolve(schemaId)` returns `SchemaPersistChanges<T>` where `T` is inferred from the schema
- The type is automatically inferred from the schema registered in the DataStore
- No need to specify generic types manually

### Example: Adding Metadata
```typescript
// ✅ CORRECT: Let the schema type inference work
const metadataChanges = bulkChanges.resolve(metadataSchema.id);
const newMetadata = metadataSchema.prepare({
    schemaId: schema.id,
    lastSyncTimestamp: serverTimestamp
});
metadataChanges.adds = [newMetadata];
// Type is automatically InferCreateType<SyncMetadata>[]

// ❌ WRONG: Don't cast or use generic type parameters unnecessarily
const metadataChanges = bulkChanges.resolve<T>(metadataSchema.id);
metadataChanges.adds = [newMetadata as InferCreateType<T>];
```

## Type Utilities

### InferType<T>
- Use for entities that have been persisted/loaded from the database
- Represents the "full" entity type with all computed properties
- Use when working with existing entities from collections
- **Always use `InferType<typeof schema>` instead of manually defining interfaces** - This ensures types stay in sync with schema definitions

### InferCreateType<T>
- Use for entities being created (not yet persisted)
- May have optional fields for auto-generated keys
- Use when adding new entities or preparing data for persistence
- **Always use `InferCreateType<typeof schema>` instead of manually defining interfaces** - This ensures types stay in sync with schema definitions

### Schema Type Inference
**Never manually define interfaces that correspond to schemas** - Always use `InferType` or `InferCreateType` to derive types from schemas:

```typescript
// ✅ CORRECT: Use InferType to derive type from schema
export const mySchema = s.define("MyEntity", {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
}).compile();

export type MyEntity = InferType<typeof mySchema>;
// MyEntity is automatically inferred from the schema definition

// ❌ WRONG: Don't manually define interfaces that match schemas
export interface MyEntity {
    id: string;
    name: string;
    age: number;
}
// This can get out of sync with the schema and loses type safety
```

### Why This Matters
- **Type safety** - Types are automatically derived from the schema, so they can't get out of sync
- **Single source of truth** - The schema is the only place you need to update when adding/removing fields
- **Automatic updates** - When schema changes, types update automatically
- **Computed properties** - `InferType` includes all computed properties and transformations from the schema

### Example: Type-Safe Operations
```typescript
// ✅ CORRECT: Use proper type utilities
const entity: InferType<MyEntity> = collection.get(id);
const newEntity: InferCreateType<MyEntity> = schema.prepare({ name: "test" });

// ❌ WRONG: Don't use any/unknown
const entity: any = collection.get(id);
const newEntity: unknown = { name: "test" };
```

## Collection Operations

### Adding Entities
- `collection.add(entities: InferCreateType<T>[], done)` - Accepts array of create types
- Use `schema.prepare()` to ensure proper type
- No casting needed

### Updating Entities
- **Entities are proxy objects** - They automatically track changes when properties are modified
- **Do NOT manually call `set()` or `markDirty()`** - Just modify properties directly
- The proxy system automatically detects changes and marks entities as dirty
- After modifying properties, call `saveChangesAsync()` to persist

### When You DO Need to Mark Dirty
- **Only when using `Object.assign()` or spread operator** - These create new objects that are not proxies
- When you create a new object with `{ ...existing }` or `Object.assign({}, existing)`, you must manually call `set()` and `markDirty()`
- Direct property assignment on proxy entities is automatically tracked

### Example: Collection Operations
```typescript
// ✅ CORRECT: Direct property modification - proxy tracks changes automatically
const existing = await collection.where((x) => x.id === id).firstOrUndefinedAsync();
if (existing) {
    existing.name = "updated";  // Proxy automatically tracks this change
    existing.age = 30;          // All changes are tracked automatically
    await collection.saveChangesAsync();  // Persist all tracked changes
}

// ✅ CORRECT: Adding new entities
const newEntity = schema.prepare({ name: "test" });
await collection.addAsync([newEntity]);

// ❌ WRONG: Don't manually call set() and markDirty() - proxies handle this
const existing = await collection.where((x) => x.id === id).firstOrUndefinedAsync();
if (existing) {
    existing.name = "updated";
    collection.attachments.set(existing);      // ❌ Unnecessary
    collection.attachments.markDirty(existing); // ❌ Unnecessary
    await collection.saveChangesAsync();
}

// ❌ WRONG: Don't cast
collection.add([{ name: "test" } as any], callback);
```

## Schema Query Operations

### Query Results
- Query results are automatically typed based on the schema
- Use `subscribe().where().toArray()` for type-safe queries
- Results are `InferType<T>[]` automatically

### Example: Querying
```typescript
// ✅ CORRECT: Type-safe queries
collection.subscribe()
    .where((x) => x.field === value)
    .toArray((result) => {
        if (result.ok === Result.SUCCESS) {
            // result.data is InferType<T>[]
            const entities: InferType<MyEntity>[] = result.data;
        }
    });

// ❌ WRONG: Don't cast query results
const entities = result.data as any[];
```

## Type Assertions and Guards

### When Type Assertions Are Acceptable
- Only use type assertions when working with `UnknownRecord` (the catch-all type)
- Prefer `satisfies` operator for type checking without narrowing
- Use Routier's assertion utilities (`assertIsNotNull`, etc.) for runtime validation

### Example: Safe Type Assertions
```typescript
// ✅ ACCEPTABLE: Working with UnknownRecord (the catch-all)
const entity = data as UnknownRecord;
const typed = entity as InferType<MyEntity>;

// ✅ PREFERRED: Use satisfies for type checking
const config = {
    schemaId: schema.id,
    timestamp: Date.now()
} satisfies InferCreateType<SyncMetadata>;

// ❌ WRONG: Unnecessary casts
const entity = data as any;
const typed = unknownValue as unknown as MyEntity;
```

## Best Practices Summary

1. **Always use `schema.prepare()`** when creating new entities - it ensures proper types and applies defaults
2. **Let TypeScript infer types** from schema operations - don't manually specify generics unless necessary
3. **Use `InferType<T>` for existing entities** and `InferCreateType<T>` for new entities
4. **Trust `bulkChanges.resolve()`** - it infers types from registered schemas
5. **Use spread operator** for updates: `{ ...existing, field: newValue }`
6. **Prefer `satisfies` over `as`** when you want type checking without type narrowing
7. **Use Routier's assertion utilities** for runtime validation instead of type casts

## Common Patterns

### Pattern 1: Creating and Adding Entities
```typescript
const newEntity = schema.prepare({
    field1: value1,
    field2: value2
});
collection.add([newEntity], callback);
```

### Pattern 2: Updating Entities (Direct Property Assignment)
```typescript
// Entities from queries are proxy objects that automatically track changes
const existing = await collection.where((x) => x.id === id).firstOrUndefinedAsync();
if (existing) {
    existing.field = newValue;  // Proxy automatically tracks this change
    await collection.saveChangesAsync();  // Persist the change
}
```

### Pattern 3: Updating Entities (Spread Operator/Object.assign)
```typescript
// When using spread operator or Object.assign, you create a new object (not a proxy)
const existing = await collection.where((x) => x.id === id).firstOrUndefinedAsync();
if (existing) {
    const updated = { ...existing, field: newValue };  // New object, not a proxy
    collection.attachments.set(updated);  // ✅ Required - new object needs to be registered
    collection.attachments.markDirty(updated);  // ✅ Required - mark as changed
    await collection.saveChangesAsync();  // Persist the change
}
```

### Pattern 3: Bulk Operations with Metadata
```typescript
const bulkChanges = new BulkPersistChanges();
const schemaChanges = bulkChanges.resolve(schema.id);
const metadataChanges = bulkChanges.resolve(metadataSchema.id);

const newMetadata = metadataSchema.prepare({
    schemaId: schema.id,
    timestamp: Date.now()
});
metadataChanges.adds = [newMetadata];
```

### Pattern 4: Type-Safe Queries
```typescript
collection.subscribe()
    .where((entity) => entity.field === value)
    .firstOrUndefined((result) => {
        if (result.ok === Result.SUCCESS && result.data) {
            const entity: InferType<MyEntity> = result.data;
        }
    });
```

## Anti-Patterns to Avoid

1. ❌ `as any` or `as unknown` casts
2. ❌ Manual generic type parameters when inference works
3. ❌ Type assertions without runtime validation
4. ❌ Creating entities without `schema.prepare()`
5. ❌ Using `any[]` for arrays of entities
6. ❌ Casting query results unnecessarily
