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



{% capture snippet_bznbzy %}{% include code/%}{% endcapture %}

```ts
{{ snippet_bznbzy | escape }}
```


Notes:

- `.tracked()` applies to computed properties. It does not change the computation, only persistence/indexability.
- Use `.tracked()` sparingly; it increases write costs but can greatly improve read performance.

## Identity and Keys

### `.key()`

Marks a property as a primary key for the entity.



{% capture snippet_85eeza %}{% include code/%}{% endcapture %}

```ts
{{ snippet_85eeza | escape }}
```


**Available on:** `string`, `number`, `date`

### `.identity()`

Automatically generates a unique value for the property.



{% capture snippet_n4hxuc %}{% include code/%}{% endcapture %}

```ts
{{ snippet_n4hxuc | escape }}
```


**Available on:** `string`, `number`, `date`, `boolean`

## Indexing

### `.index()`

Creates a database index for efficient querying.



{% capture snippet_27qlvd %}{% include code/%}{% endcapture %}

```ts
{{ snippet_27qlvd | escape }}
```


**Available on:** All types

### Compound Indexes

Multiple fields can share the same index name for compound indexing.



{% capture snippet_zcizjw %}{% include code/%}{% endcapture %}

```ts
{{ snippet_zcizjw | escape }}
```


## Defaults and Values

### `.default()`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.



{% capture snippet_9ckcic %}{% include code/%}{% endcapture %}

```ts
{{ snippet_9ckcic | escape }}
```


**Available on:** All types

**Note:** When using a function, it's evaluated each time a default is needed, making it perfect for dynamic values like timestamps or context-dependent defaults. The function can also accept an optional `injected` parameter for context-dependent defaults.

#### Insert semantics

- If a property has `.default(...)`, it is considered optional during inserts. When the value is omitted, Routier will supply the default.




{% capture snippet_2iwgt0 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_2iwgt0 | escape }}
```



## Behavior Control

### `.optional()`

Makes the property optional (can be undefined).



{% capture snippet_eimzso %}{% include code/%}{% endcapture %}

```ts
{{ snippet_eimzso | escape }}
```


**Available on:** All types

### `.nullable()`

Makes the property nullable (can be null).



{% capture snippet_tudq6i %}{% include code/%}{% endcapture %}

```ts
{{ snippet_tudq6i | escape }}
```


**Available on:** All types

### `.readonly()`

Makes the property read-only after creation.



{% capture snippet_jx409r %}{% include code/%}{% endcapture %}

```ts
{{ snippet_jx409r | escape }}
```


**Available on:** All types

## Serialization

### `.serialize()`

Custom serialization function for the property.



{% capture snippet_raovy6 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_raovy6 | escape }}
```


**Available on:** All types

### `.deserialize()`

Custom deserialization function for the property.



{% capture snippet_t98whi %}{% include code/%}{% endcapture %}

```ts
{{ snippet_t98whi | escape }}
```


**Available on:** All types

## Type Conversion

### `.array()`

Converts the property to an array type.



{% capture snippet_nv6qg0 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_nv6qg0 | escape }}
```


**Available on:** All types

### `.distinct()`

Ensures the property value is unique across all entities.



{% capture snippet_ny7toy %}{% include code/%}{% endcapture %}

```ts
{{ snippet_ny7toy | escape }}
```


**Available on:** `string`, `number`, `date`, `boolean`

## Chaining Modifiers

Modifiers can be chained together in any order:



{% capture snippet_awss86 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_awss86 | escape }}
```


## Modifier Compatibility

Not all modifiers can be used together. Here are the key rules:

### Mutually Exclusive Modifiers

- **`.optional()`** and **`.nullable()`** - Can be used together
- **`.key()`** and **`.optional()`** - Cannot be used together (keys are always required)
- **`.identity()`** and **`.default()`** - Cannot be used together (identity generates values)

### Modifier Order

While modifiers can be chained in any order, it's recommended to follow this pattern:



{% capture snippet_gye6r6 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_gye6r6 | escape }}
```


## Best Practices

### 1. **Use Built-in Modifiers**



{% capture snippet_tcl5f8 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_tcl5f8 | escape }}
```


### 2. **Define Constraints Early**



{% capture snippet_lajwjh %}{% include code/%}{% endcapture %}

```ts
{{ snippet_lajwjh | escape }}
```


### 3. **Leverage Type Safety**



{% capture snippet_68sph6 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_68sph6 | escape }}
```


### 4. **Use Appropriate Modifiers**



{% capture snippet_61aty5 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_61aty5 | escape }}
```


## Next Steps

- [Property Types](../property-types/README.md) - Available property types
- [Creating A Schema](../creating-a-schema.md) - Back to schema creation
- [Schema Reference](../reference.md) - Complete schema API reference
