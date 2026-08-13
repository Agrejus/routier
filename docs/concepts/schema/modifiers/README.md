---
title: Property Modifiers
---

# Property Modifiers

Property modifiers in Routier allow you to customize the behavior, constraints, and metadata of your schema properties. They can be chained together to create powerful, flexible schemas that accurately represent your database structure.

## Quick Summary

- Default: Define default values for properties.
- Deserialize: Custom deserializer (e.g., parse ISO strings to Date).
- Distinct: Mark property as unique (distinct index).
- Identity: Mark property as database/computed identity (auto-generated).
- Index: Define single or composite indexes.
- Key: Define primary key.
- Nullable: Allow null.
- Optional: Allow undefined (omit the field).
- Readonly: Disallow modification after creation.
- Serialize: Custom serializer (e.g., Date to ISO string).
- Tracked: Persist computed value for indexing and faster reads.

## Available Modifiers

Every property type supports `.from()`, `.optional()`, `.nullable()`, `.default()`, and `.tag()`. Other methods are type-specific and modifier wrappers may narrow the valid next methods.

Common type-specific modifiers:

- **`.key()`** — string and number
- **`.identity()`** — string, number, and object
- **`.readonly()`** — string, number, boolean, date, file, and vector
- **`.serialize()` / `.deserialize()`** — string, number, boolean, date, and array
- **`.array()`** — string, number, boolean, date, and object
- **`.index()`** — string, number, boolean, date, and array
- **`.distinct()`** — string, number, boolean, and date
- **`.foreignKey()`** — string and number
- **`.searchable()`** — string only

See [Schema API](/concepts/schema/schema-api#modifier-matrix) for the complete matrix.

## Tracked (for computed values)

### `.tracked()`

Persists a computed value to the underlying store. Use when:

- You need to index or sort/filter by the computed value
- Recomputing is expensive and you want to cache post-save

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/tracked-example.ts

Notes:

- `.tracked()` applies to computed properties. It does not change the computation, only persistence/indexability.
- Use `.tracked()` sparingly; it increases write costs but can greatly improve read performance.
- **Computed function parameters:** `(entity, collectionName, injected)` where `entity` is the current entity, `collectionName` is the schema collection name, and `injected` contains your dependencies.

## Identity and Keys

### `.key()`

Marks a property as a primary key for the entity.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/key-example.ts

**Available on:** `string`, `number`

### `.identity()`

Marks the property for automatic value generation by the datastore. The datastore will generate unique values for this property.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/identity-example.ts

**Available on:** `string`, `number`, and `object`

## Indexing

### `.index()`

Creates a database index for efficient querying.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/index-example.ts

**Available on:** `string`, `number`, `boolean`, `date`, and `array`

### Compound Indexes

Multiple fields can share the same index name for compound indexing.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/compound-index-example.ts

## Defaults and Values

### `.default()`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.

**Note:** If the default value is `null`, return it from a function (e.g. `.default(() => null)`). Passing `null` directly does not work as intended.

**Function Parameters:**

- **`.default((injected) => value, { injected })`** - Function with injected dependencies
- **`.default((injected, collectionName) => value, { injected })`** - Function with injected dependencies and collection name

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/default-example.ts

**Available on:** All types

**Note:** When using a function, it's evaluated each time a default is needed, making it perfect for dynamic values like timestamps or context-dependent defaults. The function parameters are `(injected, collectionName)` where `injected` contains your dependencies and `collectionName` is the schema collection name.

#### Insert semantics

- If a property has `.default(...)`, it is considered optional during inserts. When the value is omitted, Routier will supply the default.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/default-insert-example.ts

## Behavior Control

### `.optional()`

Makes the property optional (can be undefined).

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/optional-example.ts

**Available on:** All types

#### Optional vs nullable over HTTP

If a property is `.optional()`, its value can be `undefined`. Many HTTP/JSON serializers drop `undefined` fields, so the value may be omitted in transit. If you need the field to be sent over HTTP, prefer `.nullable().default(null)` so the payload includes an explicit `null`.

### `.nullable()`

Makes the property nullable (can be null).

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/nullable-example.ts

**Available on:** All types

### `.readonly()`

Makes the property read-only after creation.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/readonly-example.ts

**Available on:** `string`, `number`, `boolean`, `date`, `file`, and `vector`

## Serialization

### `.serialize()`

Custom serialization function for the property.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/serialize-example.ts

**Available on:** `string`, `number`, `boolean`, `date`, and `array`

### `.deserialize()`

Custom deserialization function for the property.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/deserialize-example.ts

**Available on:** `string`, `number`, `boolean`, `date`, and `array`

## Type Conversion

### `.array()`

Converts any property type to an array of that type. This allows you to combine base types with array functionality.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/type-combination-example.ts

**Available on:** `string`, `number`, `boolean`, `date`, and `object`

**Type Combinations:**

- `s.string().array()` → `string[]`
- `s.number().array()` → `number[]`
- `s.boolean().array()` → `boolean[]`
- `s.date().array()` → `Date[]`
- `s.object({...}).array()` → `object[]`

### `.distinct()`

Ensures the property value is unique across all entities.

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/distinct-example.ts

**Available on:** `string`, `number`, `date`, `boolean`

## Chaining Modifiers

Modifiers can be chained together in any order:

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/chaining-example.ts

## Modifier Compatibility

Not all modifiers can be used together. Here are the key rules based on the source code:

### Mutually Exclusive Modifiers

- **`.key()`** and **`.optional()`** - Cannot be used together (keys are always required)
- **`.identity()`** and **`.default()`** - Cannot be used together (identity generates values)
- **`.optional()`** and **`.nullable()`** - Can be used together

### Modifier Support by Type

See the source-aligned [modifier matrix](/concepts/schema/schema-api#modifier-matrix), which also covers file and vector properties. The TypeScript fluent API prevents unsupported combinations.

### Modifier Order

While modifiers can be chained in any order, it's recommended to follow this pattern:

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/order-example.ts

## Best Practices

### 1. **Use Built-in Modifiers**

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/built-in-example.ts

### 2. **Define Constraints Early**

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/constraints-example.ts

### 3. **Leverage Type Safety**

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/type-safety-example.ts

### 4. **Use Appropriate Modifiers**

<<< @/_snippets/code/from-docs/concepts/schema/modifiers/appropriate-example.ts

## Next Steps

- [Property Types](/concepts/schema/property-types/README) - Available property types
- [Creating A Schema](/concepts/schema/creating-a-schema) - Back to schema creation
