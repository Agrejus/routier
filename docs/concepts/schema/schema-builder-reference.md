# Schema Builder Reference

This document provides a comprehensive reference for the Routier schema builder, showing all available types, modifiers, and their combinations.

## Schema Builder Entry Point


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-1.ts %}{% endhighlight %}


## Available Types

### Basic Types

| Type        | Builder            | Generic Support | Description                               |
| ----------- | ------------------ | --------------- | ----------------------------------------- |
| **String**  | `s.string<T>()`    | ✅              | String with optional literal constraints  |
| **Number**  | `s.number<T>()`    | ✅              | Number with optional literal constraints  |
| **Boolean** | `s.boolean<T>()`   | ✅              | Boolean with optional literal constraints |
| **Date**    | `s.date<T>()`      | ✅              | Date with optional literal constraints    |
| **Array**   | `s.array(schema)`  | ❌              | Array containing other schemas            |
| **Object**  | `s.object(schema)` | ❌              | Object with nested schema                 |

### Type Examples


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-2.ts %}{% endhighlight %}


## Available Modifiers

### Core Modifiers (All Types)

| Modifier        | Method             | Description              | Returns             |
| --------------- | ------------------ | ------------------------ | ------------------- |
| **Optional**    | `.optional()`      | Makes property optional  | `SchemaOptional`    |
| **Nullable**    | `.nullable()`      | Allows null values       | `SchemaNullable`    |
| **Default**     | `.default(value)`  | Sets default value       | `SchemaDefault`     |
| **Readonly**    | `.readonly()`      | Makes property read-only | `SchemaReadonly`    |
| **Deserialize** | `.deserialize(fn)` | Custom deserialization   | `SchemaDeserialize` |
| **Serialize**   | `.serialize(fn)`   | Custom serialization     | `SchemaSerialize`   |
| **Array**       | `.array()`         | Converts to array type   | `SchemaArray`       |
| **Index**       | `.index(...names)` | Creates database indexes | `SchemaIndex`       |

### Type-Specific Modifiers

| Modifier     | Method        | Available On                          | Description           | Returns          |
| ------------ | ------------- | ------------------------------------- | --------------------- | ---------------- |
| **Key**      | `.key()`      | `string`, `number`, `date`            | Marks as primary key  | `SchemaKey`      |
| **Identity** | `.identity()` | `string`, `number`, `date`, `boolean` | Auto-generates values | `SchemaIdentity` |
| **Distinct** | `.distinct()` | `string`, `number`, `date`, `boolean` | Ensures unique values | `SchemaDistinct` |

## Complete Modifier Reference

### `.optional()`

Makes a property optional (can be undefined).


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-3.ts %}{% endhighlight %}


### `.nullable()`

Makes a property nullable (can be null).


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-4.ts %}{% endhighlight %}


### `.default(value | function)`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-5.ts %}{% endhighlight %}


### `.readonly()`

Makes a property read-only after creation.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-6.ts %}{% endhighlight %}


### `.deserialize(fn)`

Custom deserialization function.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-7.ts %}{% endhighlight %}


### `.serialize(fn)`

Custom serialization function.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-8.ts %}{% endhighlight %}


### `.array()`

Converts the property to an array type.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-9.ts %}{% endhighlight %}


### `.index(...names)`

Creates database indexes for efficient querying.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-10.ts %}{% endhighlight %}


### `.key()`

Marks a property as a primary key.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-11.ts %}{% endhighlight %}


### `.identity()`

Automatically generates values for the property.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-12.ts %}{% endhighlight %}


### `.distinct()`

Ensures the property value is unique across all entities.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-13.ts %}{% endhighlight %}


## Modifier Combinations

### Valid Combinations

Modifiers can be chained together in various combinations:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-14.ts %}{% endhighlight %}


### Mutually Exclusive Modifiers

Some modifiers cannot be used together:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-15.ts %}{% endhighlight %}


## Default Value Examples

### Direct Values vs Functions


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-16.ts %}{% endhighlight %}


## Complete Schema Examples

### Basic User Schema


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-17.ts %}{% endhighlight %}


### Complex Product Schema


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-18.ts %}{% endhighlight %}


### Nested Schema Example


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-19.ts %}{% endhighlight %}


## Best Practices

### 1. **Use Literal Types for Constraints**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-20.ts %}{% endhighlight %}


### 2. **Chain Modifiers Logically**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-21.ts %}{% endhighlight %}


### 3. **Use Appropriate Modifiers**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-22.ts %}{% endhighlight %}


### 4. **Leverage Type Safety**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-23.ts %}{% endhighlight %}


## Type Compatibility Matrix

| Type        | Optional | Nullable | Default | Readonly | Deserialize | Serialize | Array | Index | Key | Identity | Distinct |
| ----------- | -------- | -------- | ------- | -------- | ----------- | --------- | ----- | ----- | --- | -------- | -------- |
| **String**  | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ✅  | ✅       | ✅       |
| **Number**  | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ✅  | ✅       | ✅       |
| **Boolean** | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ❌  | ✅       | ✅       |
| **Date**    | ✅       | ✅       | ✅      | ✅       | ✅          | ✅        | ✅    | ✅    | ✅  | ✅       | ✅       |
| **Object**  | ✅       | ✅       | ✅      | ✅       | ❌          | ❌        | ✅    | ❌    | ❌  | ✅       | ❌       |
| **Array**   | ✅       | ✅       | ✅      | ❌       | ✅          | ✅        | ❌    | ✅    | ❌  | ❌       | ❌       |

## Next Steps

- [Creating A Schema](creating-a-schema.md) - How to create schemas
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - All available property modifiers
- [Schema Reference](reference.md) - Complete schema API reference
