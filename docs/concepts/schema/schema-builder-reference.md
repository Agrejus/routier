---
title: Schema Builder Reference
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 5
---

# Schema Builder Reference

This document provides a comprehensive reference for the Routier schema builder, showing all available types, modifiers, and their combinations.

## Schema Builder Entry Point

{% capture snippet_8cm52t %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8cm52t  | strip }}{% endhighlight %}

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

{% capture snippet_gfez9z %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gfez9z  | strip }}{% endhighlight %}

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

{% capture snippet_8dsdf8 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8dsdf8  | strip }}{% endhighlight %}

### `.nullable()`

Makes a property nullable (can be null).

{% capture snippet_k2jdpf %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_k2jdpf  | strip }}{% endhighlight %}

### `.default(value | function)`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.

{% capture snippet_90gw2s %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_90gw2s  | strip }}{% endhighlight %}

### `.readonly()`

Makes a property read-only after creation.

{% capture snippet_kgnh25 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kgnh25  | strip }}{% endhighlight %}

### `.deserialize(fn)`

Custom deserialization function.

{% capture snippet_okmtsl %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_okmtsl  | strip }}{% endhighlight %}

### `.serialize(fn)`

Custom serialization function.

{% capture snippet_he5sbw %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_he5sbw  | strip }}{% endhighlight %}

### `.array()`

Converts the property to an array type.

{% capture snippet_qxhxtr %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_qxhxtr  | strip }}{% endhighlight %}

### `.index(...names)`

Creates database indexes for efficient querying.

{% capture snippet_5ohv3o %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_5ohv3o  | strip }}{% endhighlight %}

### `.key()`

Marks a property as a primary key.

{% capture snippet_m3j2uu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_m3j2uu  | strip }}{% endhighlight %}

### `.identity()`

Automatically generates values for the property.

{% capture snippet_h8ny08 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_h8ny08  | strip }}{% endhighlight %}

### `.distinct()`

Ensures the property value is unique across all entities.

{% capture snippet_62tgt9 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_62tgt9  | strip }}{% endhighlight %}

## Modifier Combinations

### Valid Combinations

Modifiers can be chained together in various combinations:

{% capture snippet_4rg6wf %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_4rg6wf  | strip }}{% endhighlight %}

### Mutually Exclusive Modifiers

Some modifiers cannot be used together:

{% capture snippet_6a74o4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_6a74o4  | strip }}{% endhighlight %}

## Default Value Examples

### Direct Values vs Functions

{% capture snippet_6p78eb %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_6p78eb  | strip }}{% endhighlight %}

## Complete Schema Examples

### Basic User Schema

{% capture snippet_96r2ir %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_96r2ir  | strip }}{% endhighlight %}

### Complex Product Schema

{% capture snippet_apywbi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_apywbi  | strip }}{% endhighlight %}

### Nested Schema Example

{% capture snippet_ypqptf %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ypqptf  | strip }}{% endhighlight %}

## Best Practices

### 1. **Use Literal Types for Constraints**

{% capture snippet_iymov7 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_iymov7  | strip }}{% endhighlight %}

### 2. **Chain Modifiers Logically**

{% capture snippet_e5lrx4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_e5lrx4  | strip }}{% endhighlight %}

### 3. **Use Appropriate Modifiers**

{% capture snippet_rn5a2b %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_rn5a2b  | strip }}{% endhighlight %}

### 4. **Leverage Type Safety**

{% capture snippet_mzv6in %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_mzv6in  | strip }}{% endhighlight %}

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
