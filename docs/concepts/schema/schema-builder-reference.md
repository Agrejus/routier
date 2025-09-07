# Schema Builder Reference

This document provides a comprehensive reference for the Routier schema builder, showing all available types, modifiers, and their combinations.

## Schema Builder Entry Point


{% capture snippet_8cm52t %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_8cm52t }}{% endhighlight %}


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


{% capture snippet_gfez9z %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_gfez9z }}{% endhighlight %}


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


{% capture snippet_8dsdf8 %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_8dsdf8 }}{% endhighlight %}


### `.nullable()`

Makes a property nullable (can be null).


{% capture snippet_k2jdpf %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_k2jdpf }}{% endhighlight %}


### `.default(value | function)`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.


{% capture snippet_90gw2s %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_90gw2s }}{% endhighlight %}


### `.readonly()`

Makes a property read-only after creation.


{% capture snippet_kgnh25 %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_kgnh25 }}{% endhighlight %}


### `.deserialize(fn)`

Custom deserialization function.


{% capture snippet_okmtsl %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_okmtsl }}{% endhighlight %}


### `.serialize(fn)`

Custom serialization function.


{% capture snippet_he5sbw %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_he5sbw }}{% endhighlight %}


### `.array()`

Converts the property to an array type.


{% capture snippet_qxhxtr %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_qxhxtr }}{% endhighlight %}


### `.index(...names)`

Creates database indexes for efficient querying.


{% capture snippet_5ohv3o %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_5ohv3o }}{% endhighlight %}


### `.key()`

Marks a property as a primary key.


{% capture snippet_m3j2uu %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_m3j2uu }}{% endhighlight %}


### `.identity()`

Automatically generates values for the property.


{% capture snippet_h8ny08 %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_h8ny08 }}{% endhighlight %}


### `.distinct()`

Ensures the property value is unique across all entities.


{% capture snippet_62tgt9 %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_62tgt9 }}{% endhighlight %}


## Modifier Combinations

### Valid Combinations

Modifiers can be chained together in various combinations:


{% capture snippet_4rg6wf %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_4rg6wf }}{% endhighlight %}


### Mutually Exclusive Modifiers

Some modifiers cannot be used together:


{% capture snippet_6a74o4 %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_6a74o4 }}{% endhighlight %}


## Default Value Examples

### Direct Values vs Functions


{% capture snippet_6p78eb %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_6p78eb }}{% endhighlight %}


## Complete Schema Examples

### Basic User Schema


{% capture snippet_96r2ir %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_96r2ir }}{% endhighlight %}


### Complex Product Schema


{% capture snippet_apywbi %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_apywbi }}{% endhighlight %}


### Nested Schema Example


{% capture snippet_ypqptf %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-19.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ypqptf }}{% endhighlight %}


## Best Practices

### 1. **Use Literal Types for Constraints**


{% capture snippet_iymov7 %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-20.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_iymov7 }}{% endhighlight %}


### 2. **Chain Modifiers Logically**


{% capture snippet_e5lrx4 %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-21.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_e5lrx4 }}{% endhighlight %}


### 3. **Use Appropriate Modifiers**


{% capture snippet_rn5a2b %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-22.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_rn5a2b }}{% endhighlight %}


### 4. **Leverage Type Safety**


{% capture snippet_mzv6in %}{% include code/from-docs/concepts/schema/schema-builder-reference/block-23.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_mzv6in }}{% endhighlight %}


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
