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
{% highlight ts %}{{ snippet_zkjtsz  | strip }}{% endhighlight %}

### `s.define(name, properties)`

Defines a named schema with properties and returns a schema builder.

{% capture snippet_05owr1 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_05owr1  | strip }}{% endhighlight %}

### `s.array(elementType)`

Creates an array schema with the specified element type.

{% capture snippet_pcv2m5 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pcv2m5  | strip }}{% endhighlight %}

### `s.union(types)`

Creates a union schema that accepts any of the specified types.

{% capture snippet_p2fxbx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_p2fxbx  | strip }}{% endhighlight %}

### `s.literal(...values)`

Creates a literal schema that only accepts the specified values.

{% capture snippet_zli77j %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zli77j  | strip }}{% endhighlight %}

### `s.any()`

Creates a schema that accepts any value.

{% capture snippet_8oiehv %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8oiehv  | strip }}{% endhighlight %}

### `s.unknown()`

Creates a schema that accepts unknown values (safer than `any`).

{% capture snippet_ln12ss %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ln12ss  | strip }}{% endhighlight %}

### `s.record(keyType, valueType)`

Creates a record schema for key-value pairs.

{% capture snippet_7jufvm %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7jufvm  | strip }}{% endhighlight %}

## Property Types

### String Properties

{% capture snippet_2nkuuy %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2nkuuy  | strip }}{% endhighlight %}

### Number Properties

{% capture snippet_jkp6m3 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jkp6m3  | strip }}{% endhighlight %}

### Boolean Properties

{% capture snippet_rclo3b %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_rclo3b  | strip }}{% endhighlight %}

### Date Properties

{% capture snippet_iipob8 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_iipob8  | strip }}{% endhighlight %}

## Property Modifiers

### Identity and Keys

{% capture snippet_snx4al %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_snx4al  | strip }}{% endhighlight %}

### Indexing

{% capture snippet_c800du %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_c800du  | strip }}{% endhighlight %}

### Type Safety

{% capture snippet_95d00b %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_95d00b  | strip }}{% endhighlight %}

### Defaults and Values

{% capture snippet_5503v4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_5503v4  | strip }}{% endhighlight %}

### Behavior Control

{% capture snippet_7m792n %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7m792n  | strip }}{% endhighlight %}

### Serialization

{% capture snippet_06sj57 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_06sj57  | strip }}{% endhighlight %}

## Schema Modification

### `.modify(modifier)`

Applies modifications to the schema.

{% capture snippet_lgafm5 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_lgafm5  | strip }}{% endhighlight %}

### Computed Properties

{% capture snippet_zuzs5v %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zuzs5v  | strip }}{% endhighlight %}

### Function Properties

{% capture snippet_8hwrmn %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8hwrmn  | strip }}{% endhighlight %}

## Schema Compilation

### `.compile()`

Compiles the schema into its final form.

{% capture snippet_fddsty %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fddsty  | strip }}{% endhighlight %}

## Schema Information

### `.getProperties()`

Returns information about all properties in the schema.

{% capture snippet_19bz4t %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_19bz4t  | strip }}{% endhighlight %}

### `.getIndexes()`

Returns information about all indexes in the schema.

{% capture snippet_cjthvu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_cjthvu  | strip }}{% endhighlight %}

### `.getIdProperties()`

Returns information about identity properties.

{% capture snippet_rwhjlt %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_rwhjlt  | strip }}{% endhighlight %}

### `.hasIdentityKeys`

Boolean indicating if the schema has identity keys.

{% capture snippet_fplcxj %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fplcxj  | strip }}{% endhighlight %}

## Type Inference

### `InferType<T>`

Extracts the TypeScript type from a schema.

{% capture snippet_zzserb %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zzserb  | strip }}{% endhighlight %}

### `InferCreateType<T>`

Extracts the creation type (without identity fields).

{% capture snippet_4gaf0f %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_4gaf0f  | strip }}{% endhighlight %}

## Schema Structure Checking

### `.validate(data)`

Validates data against the schema.

{% capture snippet_z0yl02 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_z0yl02  | strip }}{% endhighlight %}

### `.isValid(data)`

Quick check if data is valid.

{% capture snippet_n1vtpw %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_n1vtpw  | strip }}{% endhighlight %}

## Schema Serialization

### `.serialize(data)`

Serializes data according to schema rules.

{% capture snippet_hpemqu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_hpemqu  | strip }}{% endhighlight %}

### `.deserialize(data)`

Deserializes data according to schema rules.

{% capture snippet_azauja %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_azauja  | strip }}{% endhighlight %}

## Advanced Features

### Custom Validators

{% capture snippet_92nuzd %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_92nuzd  | strip }}{% endhighlight %}

### Conditional Type Checking

{% capture snippet_ju3pq7 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ju3pq7  | strip }}{% endhighlight %}

### Dynamic Schemas

{% capture snippet_c74ymd %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_c74ymd  | strip }}{% endhighlight %}

## Best Practices

### 1. **Schema Organization**

{% capture snippet_2uqlc6 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2uqlc6  | strip }}{% endhighlight %}

### 2. **Type Safety Strategy**

{% capture snippet_8ail1k %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8ail1k  | strip }}{% endhighlight %}

### 3. **Type Safety**

{% capture snippet_2yg31j %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2yg31j  | strip }}{% endhighlight %}

### 4. **Performance Considerations**

{% capture snippet_uz1yp3 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_uz1yp3  | strip }}{% endhighlight %}

## Error Handling

### Type Safety Errors

{% capture snippet_sh61ip %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sh61ip  | strip }}{% endhighlight %}

### Schema Compilation Errors

{% capture snippet_qzbwjx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_qzbwjx  | strip }}{% endhighlight %}

## Next Steps

- [Creating A Schema](creating-a-schema.md) - Back to schema creation guide
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - Property modifier reference
- [Why Schemas?](why-schemas.md) - Understanding schema benefits
