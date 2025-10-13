---
title: Property Modifiers
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 3
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

All schema types support these core modifiers:

- **`.optional()`** - Makes the property optional
- **`.nullable()`** - Allows the property to be null
- **`.default(value)`** - Sets a default value
- **`.readonly()`** - Makes the property read-only
- **`.deserialize(fn)`** - Custom deserialization function
- **`.serialize(fn)`** - Custom serialization function
- **`.array()`** - Converts the property to an array type
- **`.index(...names)`** - Creates database indexes

Additional modifiers are available on specific types:

- **`.key()`** - Marks as primary key (string, number, date)
- **`.identity()`** - Auto-generates values (string, number, date, boolean)
- **`.distinct()`** - Ensures unique values (string, number, date, boolean)

## Tracked (for computed values)

### `.tracked()`

Persists a computed value to the underlying store. Use when:

- You need to index or sort/filter by the computed value
- Recomputing is expensive and you want to cache post-save

{% capture snippet_bznbzy %}{% include code/from-docs/concepts/schema/modifiers/tracked-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_bznbzy  | strip }}{% endhighlight %}

Notes:

- `.tracked()` applies to computed properties. It does not change the computation, only persistence/indexability.
- Use `.tracked()` sparingly; it increases write costs but can greatly improve read performance.
- **Computed function parameters:** `(entity, collectionName, injected)` where `entity` is the current entity, `collectionName` is the schema collection name, and `injected` contains your dependencies.

## Identity and Keys

### `.key()`

Marks a property as a primary key for the entity.

{% capture snippet_85eeza %}{% include code/from-docs/concepts/schema/modifiers/key-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_85eeza  | strip }}{% endhighlight %}

**Available on:** `string`, `number`, `date`

### `.identity()`

Marks the property for automatic value generation by the datastore. The datastore will generate unique values for this property.

{% capture snippet_n4hxuc %}{% include code/from-docs/concepts/schema/modifiers/identity-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_n4hxuc  | strip }}{% endhighlight %}

**Available on:** `string`, `number`, `date`, `boolean`

## Indexing

### `.index()`

Creates a database index for efficient querying.

{% capture snippet_27qlvd %}{% include code/from-docs/concepts/schema/modifiers/index-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_27qlvd  | strip }}{% endhighlight %}

**Available on:** All types

### Compound Indexes

Multiple fields can share the same index name for compound indexing.

{% capture snippet_zcizjw %}{% include code/from-docs/concepts/schema/modifiers/compound-index-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zcizjw  | strip }}{% endhighlight %}

## Defaults and Values

### `.default()`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.

**Function Parameters:**

- **`.default((injected) => value, { injected })`** - Function with injected dependencies
- **`.default((injected, collectionName) => value, { injected })`** - Function with injected dependencies and collection name

{% capture snippet_9ckcic %}{% include code/from-docs/concepts/schema/modifiers/default-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_9ckcic  | strip }}{% endhighlight %}

**Available on:** All types

**Note:** When using a function, it's evaluated each time a default is needed, making it perfect for dynamic values like timestamps or context-dependent defaults. The function parameters are `(injected, collectionName)` where `injected` contains your dependencies and `collectionName` is the schema collection name.

#### Insert semantics

- If a property has `.default(...)`, it is considered optional during inserts. When the value is omitted, Routier will supply the default.

{% capture snippet_2iwgt0 %}{% include code/from-docs/concepts/schema/modifiers/default-insert-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2iwgt0  | strip }}{% endhighlight %}

## Behavior Control

### `.optional()`

Makes the property optional (can be undefined).

{% capture snippet_eimzso %}{% include code/from-docs/concepts/schema/modifiers/optional-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_eimzso  | strip }}{% endhighlight %}

**Available on:** All types

### `.nullable()`

Makes the property nullable (can be null).

{% capture snippet_tudq6i %}{% include code/from-docs/concepts/schema/modifiers/nullable-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_tudq6i  | strip }}{% endhighlight %}

**Available on:** All types

### `.readonly()`

Makes the property read-only after creation.

{% capture snippet_jx409r %}{% include code/from-docs/concepts/schema/modifiers/readonly-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jx409r  | strip }}{% endhighlight %}

**Available on:** All types

## Serialization

### `.serialize()`

Custom serialization function for the property.

{% capture snippet_raovy6 %}{% include code/from-docs/concepts/schema/modifiers/serialize-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_raovy6  | strip }}{% endhighlight %}

**Available on:** All types

### `.deserialize()`

Custom deserialization function for the property.

{% capture snippet_t98whi %}{% include code/from-docs/concepts/schema/modifiers/deserialize-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_t98whi  | strip }}{% endhighlight %}

**Available on:** All types

## Type Conversion

### `.array()`

Converts any property type to an array of that type. This allows you to combine base types with array functionality.

{% capture snippet_nv6qg0 %}{% include code/from-docs/concepts/schema/modifiers/type-combination-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_nv6qg0  | strip }}{% endhighlight %}

**Available on:** All types

**Type Combinations:**

- `s.string().array()` → `string[]`
- `s.number().array()` → `number[]`
- `s.boolean().array()` → `boolean[]`
- `s.date().array()` → `Date[]`
- `s.object({...}).array()` → `object[]`

### `.distinct()`

Ensures the property value is unique across all entities.

{% capture snippet_ny7toy %}{% include code/from-docs/concepts/schema/modifiers/distinct-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ny7toy  | strip }}{% endhighlight %}

**Available on:** `string`, `number`, `date`, `boolean`

## Chaining Modifiers

Modifiers can be chained together in any order:

{% capture snippet_awss86 %}{% include code/from-docs/concepts/schema/modifiers/chaining-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_awss86  | strip }}{% endhighlight %}

## Modifier Compatibility

Not all modifiers can be used together. Here are the key rules based on the source code:

### Mutually Exclusive Modifiers

- **`.key()`** and **`.optional()`** - Cannot be used together (keys are always required)
- **`.identity()`** and **`.default()`** - Cannot be used together (identity generates values)
- **`.optional()`** and **`.nullable()`** - Can be used together

### Modifier Support by Type

| Modifier         | string | number | boolean | date | object | array |
| ---------------- | ------ | ------ | ------- | ---- | ------ | ----- |
| `.optional()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.nullable()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.default()`     | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.readonly()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.serialize()`   | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.deserialize()` | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.array()`       | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.index()`       | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.key()`         | ✅     | ✅     | ❌      | ✅   | ❌     | ❌    |
| `.identity()`    | ✅     | ✅     | ✅      | ✅   | ❌     | ❌    |
| `.distinct()`    | ✅     | ✅     | ✅      | ✅   | ❌     | ❌    |

### Modifier Order

While modifiers can be chained in any order, it's recommended to follow this pattern:

{% capture snippet_gye6r6 %}{% include code/from-docs/concepts/schema/modifiers/order-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gye6r6  | strip }}{% endhighlight %}

## Best Practices

### 1. **Use Built-in Modifiers**

{% capture snippet_tcl5f8 %}{% include code/from-docs/concepts/schema/modifiers/built-in-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_tcl5f8  | strip }}{% endhighlight %}

### 2. **Define Constraints Early**

{% capture snippet_lajwjh %}{% include code/from-docs/concepts/schema/modifiers/constraints-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_lajwjh  | strip }}{% endhighlight %}

### 3. **Leverage Type Safety**

{% capture snippet_68sph6 %}{% include code/from-docs/concepts/schema/modifiers/type-safety-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_68sph6  | strip }}{% endhighlight %}

### 4. **Use Appropriate Modifiers**

{% capture snippet_61aty5 %}{% include code/from-docs/concepts/schema/modifiers/appropriate-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_61aty5  | strip }}{% endhighlight %}

## Next Steps

- [Property Types](../property-types/README.md) - Available property types
- [Creating A Schema](../creating-a-schema.md) - Back to schema creation
