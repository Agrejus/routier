---
title: Schema Reference
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 6
---

# Schema Reference

Complete API reference for Routier schemas, including all methods, types, and advanced features.

## Schema Builder

### `s.object()`

Creates an object schema with the specified properties.

{% capture snippet_zkjtsz %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zkjtsz | escape }}{% endhighlight %}

### `s.define(name, properties)`

Defines a named schema with properties and returns a schema builder.

{% capture snippet_05owr1 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_05owr1 | escape }}{% endhighlight %}

### `s.array(elementType)`

Creates an array schema with the specified element type.

{% capture snippet_pcv2m5 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pcv2m5 | escape }}{% endhighlight %}

### `s.union(types)`

Creates a union schema that accepts any of the specified types.

{% capture snippet_p2fxbx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_p2fxbx | escape }}{% endhighlight %}

### `s.literal(...values)`

Creates a literal schema that only accepts the specified values.

{% capture snippet_zli77j %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zli77j | escape }}{% endhighlight %}

### `s.any()`

Creates a schema that accepts any value.

{% capture snippet_8oiehv %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8oiehv | escape }}{% endhighlight %}

### `s.unknown()`

Creates a schema that accepts unknown values (safer than `any`).

{% capture snippet_ln12ss %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ln12ss | escape }}{% endhighlight %}

### `s.record(keyType, valueType)`

Creates a record schema for key-value pairs.

{% capture snippet_7jufvm %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7jufvm | escape }}{% endhighlight %}

## Property Types

### String Properties

{% capture snippet_2nkuuy %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2nkuuy | escape }}{% endhighlight %}

### Number Properties

{% capture snippet_jkp6m3 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jkp6m3 | escape }}{% endhighlight %}

### Boolean Properties

{% capture snippet_rclo3b %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_rclo3b | escape }}{% endhighlight %}

### Date Properties

{% capture snippet_iipob8 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_iipob8 | escape }}{% endhighlight %}

## Property Modifiers

### Identity and Keys

{% capture snippet_snx4al %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_snx4al | escape }}{% endhighlight %}

### Indexing

{% capture snippet_c800du %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_c800du | escape }}{% endhighlight %}

### Validation

{% capture snippet_95d00b %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_95d00b | escape }}{% endhighlight %}

### Defaults and Values

{% capture snippet_5503v4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_5503v4 | escape }}{% endhighlight %}

### Behavior Control

{% capture snippet_7m792n %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7m792n | escape }}{% endhighlight %}

### Serialization

{% capture snippet_06sj57 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_06sj57 | escape }}{% endhighlight %}

## Schema Modification

### `.modify(modifier)`

Applies modifications to the schema.

{% capture snippet_lgafm5 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_lgafm5 | escape }}{% endhighlight %}

### Computed Properties

{% capture snippet_zuzs5v %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zuzs5v | escape }}{% endhighlight %}

### Function Properties

{% capture snippet_8hwrmn %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8hwrmn | escape }}{% endhighlight %}

## Schema Compilation

### `.compile()`

Compiles the schema into its final form.

{% capture snippet_fddsty %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fddsty | escape }}{% endhighlight %}

## Schema Information

### `.getProperties()`

Returns information about all properties in the schema.

{% capture snippet_19bz4t %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_19bz4t | escape }}{% endhighlight %}

### `.getIndexes()`

Returns information about all indexes in the schema.

{% capture snippet_cjthvu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_cjthvu | escape }}{% endhighlight %}

### `.getIdProperties()`

Returns information about identity properties.

{% capture snippet_rwhjlt %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_rwhjlt | escape }}{% endhighlight %}

### `.hasIdentityKeys`

Boolean indicating if the schema has identity keys.

{% capture snippet_fplcxj %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fplcxj | escape }}{% endhighlight %}

## Type Inference

### `InferType<T>`

Extracts the TypeScript type from a schema.

{% capture snippet_zzserb %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zzserb | escape }}{% endhighlight %}

### `InferCreateType<T>`

Extracts the creation type (without identity fields).

{% capture snippet_4gaf0f %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_4gaf0f | escape }}{% endhighlight %}

## Schema Structure Checking

### `.validate(data)`

Validates data against the schema.

{% capture snippet_z0yl02 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_z0yl02 | escape }}{% endhighlight %}

### `.isValid(data)`

Quick check if data is valid.

{% capture snippet_n1vtpw %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_n1vtpw | escape }}{% endhighlight %}

## Schema Serialization

### `.serialize(data)`

Serializes data according to schema rules.

{% capture snippet_hpemqu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_hpemqu | escape }}{% endhighlight %}

### `.deserialize(data)`

Deserializes data according to schema rules.

{% capture snippet_azauja %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_azauja | escape }}{% endhighlight %}

## Advanced Features

### Custom Validators

{% capture snippet_92nuzd %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_92nuzd | escape }}{% endhighlight %}

### Conditional Validation

{% capture snippet_ju3pq7 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ju3pq7 | escape }}{% endhighlight %}

### Dynamic Schemas

{% capture snippet_c74ymd %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_c74ymd | escape }}{% endhighlight %}

## Best Practices

### 1. **Schema Organization**

{% capture snippet_2uqlc6 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2uqlc6 | escape }}{% endhighlight %}

### 2. **Validation Strategy**

{% capture snippet_8ail1k %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8ail1k | escape }}{% endhighlight %}

### 3. **Type Safety**

{% capture snippet_2yg31j %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2yg31j | escape }}{% endhighlight %}

### 4. **Performance Considerations**

{% capture snippet_uz1yp3 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_uz1yp3 | escape }}{% endhighlight %}

## Error Handling

### Validation Errors

{% capture snippet_sh61ip %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sh61ip | escape }}{% endhighlight %}

### Schema Compilation Errors

{% capture snippet_qzbwjx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_qzbwjx | escape }}{% endhighlight %}

## Next Steps

- [Creating A Schema](creating-a-schema.md) - Back to schema creation guide
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - Property modifier reference
- [Why Schemas?](why-schemas.md) - Understanding schema benefits
