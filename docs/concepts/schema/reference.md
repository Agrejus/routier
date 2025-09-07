# Schema Reference

Complete API reference for Routier schemas, including all methods, types, and advanced features.

## Schema Builder

### `s.object()`

Creates an object schema with the specified properties.


{% capture snippet_zkjtsz %}{% include code/from-docs/concepts/schema/reference/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_zkjtsz }}{% endhighlight %}


### `s.define(name, properties)`

Defines a named schema with properties and returns a schema builder.


{% capture snippet_05owr1 %}{% include code/from-docs/concepts/schema/reference/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_05owr1 }}{% endhighlight %}


### `s.array(elementType)`

Creates an array schema with the specified element type.


{% capture snippet_pcv2m5 %}{% include code/from-docs/concepts/schema/reference/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_pcv2m5 }}{% endhighlight %}


### `s.union(types)`

Creates a union schema that accepts any of the specified types.


{% capture snippet_p2fxbx %}{% include code/from-docs/concepts/schema/reference/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_p2fxbx }}{% endhighlight %}


### `s.literal(...values)`

Creates a literal schema that only accepts the specified values.


{% capture snippet_zli77j %}{% include code/from-docs/concepts/schema/reference/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_zli77j }}{% endhighlight %}


### `s.any()`

Creates a schema that accepts any value.


{% capture snippet_8oiehv %}{% include code/from-docs/concepts/schema/reference/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_8oiehv }}{% endhighlight %}


### `s.unknown()`

Creates a schema that accepts unknown values (safer than `any`).


{% capture snippet_ln12ss %}{% include code/from-docs/concepts/schema/reference/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ln12ss }}{% endhighlight %}


### `s.record(keyType, valueType)`

Creates a record schema for key-value pairs.


{% capture snippet_7jufvm %}{% include code/from-docs/concepts/schema/reference/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_7jufvm }}{% endhighlight %}


## Property Types

### String Properties


{% capture snippet_2nkuuy %}{% include code/from-docs/concepts/schema/reference/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_2nkuuy }}{% endhighlight %}


### Number Properties


{% capture snippet_jkp6m3 %}{% include code/from-docs/concepts/schema/reference/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_jkp6m3 }}{% endhighlight %}


### Boolean Properties


{% capture snippet_rclo3b %}{% include code/from-docs/concepts/schema/reference/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_rclo3b }}{% endhighlight %}


### Date Properties


{% capture snippet_iipob8 %}{% include code/from-docs/concepts/schema/reference/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_iipob8 }}{% endhighlight %}


## Property Modifiers

### Identity and Keys


{% capture snippet_snx4al %}{% include code/from-docs/concepts/schema/reference/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_snx4al }}{% endhighlight %}


### Indexing


{% capture snippet_c800du %}{% include code/from-docs/concepts/schema/reference/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_c800du }}{% endhighlight %}


### Validation


{% capture snippet_95d00b %}{% include code/from-docs/concepts/schema/reference/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_95d00b }}{% endhighlight %}


### Defaults and Values


{% capture snippet_5503v4 %}{% include code/from-docs/concepts/schema/reference/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_5503v4 }}{% endhighlight %}


### Behavior Control


{% capture snippet_7m792n %}{% include code/from-docs/concepts/schema/reference/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_7m792n }}{% endhighlight %}


### Serialization


{% capture snippet_06sj57 %}{% include code/from-docs/concepts/schema/reference/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_06sj57 }}{% endhighlight %}


## Schema Modification

### `.modify(modifier)`

Applies modifications to the schema.


{% capture snippet_lgafm5 %}{% include code/from-docs/concepts/schema/reference/block-19.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_lgafm5 }}{% endhighlight %}


### Computed Properties


{% capture snippet_zuzs5v %}{% include code/from-docs/concepts/schema/reference/block-20.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_zuzs5v }}{% endhighlight %}


### Function Properties


{% capture snippet_8hwrmn %}{% include code/from-docs/concepts/schema/reference/block-21.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_8hwrmn }}{% endhighlight %}


## Schema Compilation

### `.compile()`

Compiles the schema into its final form.


{% capture snippet_fddsty %}{% include code/from-docs/concepts/schema/reference/block-22.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_fddsty }}{% endhighlight %}


## Schema Information

### `.getProperties()`

Returns information about all properties in the schema.


{% capture snippet_19bz4t %}{% include code/from-docs/concepts/schema/reference/block-23.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_19bz4t }}{% endhighlight %}


### `.getIndexes()`

Returns information about all indexes in the schema.


{% capture snippet_cjthvu %}{% include code/from-docs/concepts/schema/reference/block-24.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_cjthvu }}{% endhighlight %}


### `.getIdProperties()`

Returns information about identity properties.


{% capture snippet_rwhjlt %}{% include code/from-docs/concepts/schema/reference/block-25.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_rwhjlt }}{% endhighlight %}


### `.hasIdentityKeys`

Boolean indicating if the schema has identity keys.


{% capture snippet_fplcxj %}{% include code/from-docs/concepts/schema/reference/block-26.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_fplcxj }}{% endhighlight %}


## Type Inference

### `InferType<T>`

Extracts the TypeScript type from a schema.


{% capture snippet_zzserb %}{% include code/from-docs/concepts/schema/reference/block-27.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_zzserb }}{% endhighlight %}


### `InferCreateType<T>`

Extracts the creation type (without identity fields).


{% capture snippet_4gaf0f %}{% include code/from-docs/concepts/schema/reference/block-28.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_4gaf0f }}{% endhighlight %}


## Schema Structure Checking

### `.validate(data)`

Validates data against the schema.


{% capture snippet_z0yl02 %}{% include code/from-docs/concepts/schema/reference/block-29.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_z0yl02 }}{% endhighlight %}


### `.isValid(data)`

Quick check if data is valid.


{% capture snippet_n1vtpw %}{% include code/from-docs/concepts/schema/reference/block-30.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_n1vtpw }}{% endhighlight %}


## Schema Serialization

### `.serialize(data)`

Serializes data according to schema rules.


{% capture snippet_hpemqu %}{% include code/from-docs/concepts/schema/reference/block-31.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_hpemqu }}{% endhighlight %}


### `.deserialize(data)`

Deserializes data according to schema rules.


{% capture snippet_azauja %}{% include code/from-docs/concepts/schema/reference/block-32.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_azauja }}{% endhighlight %}


## Advanced Features

### Custom Validators


{% capture snippet_92nuzd %}{% include code/from-docs/concepts/schema/reference/block-33.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_92nuzd }}{% endhighlight %}


### Conditional Validation


{% capture snippet_ju3pq7 %}{% include code/from-docs/concepts/schema/reference/block-34.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ju3pq7 }}{% endhighlight %}


### Dynamic Schemas


{% capture snippet_c74ymd %}{% include code/from-docs/concepts/schema/reference/block-35.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_c74ymd }}{% endhighlight %}


## Best Practices

### 1. **Schema Organization**


{% capture snippet_2uqlc6 %}{% include code/from-docs/concepts/schema/reference/block-36.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_2uqlc6 }}{% endhighlight %}


### 2. **Validation Strategy**


{% capture snippet_8ail1k %}{% include code/from-docs/concepts/schema/reference/block-37.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_8ail1k }}{% endhighlight %}


### 3. **Type Safety**


{% capture snippet_2yg31j %}{% include code/from-docs/concepts/schema/reference/block-38.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_2yg31j }}{% endhighlight %}


### 4. **Performance Considerations**


{% capture snippet_uz1yp3 %}{% include code/from-docs/concepts/schema/reference/block-39.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_uz1yp3 }}{% endhighlight %}


## Error Handling

### Validation Errors


{% capture snippet_sh61ip %}{% include code/from-docs/concepts/schema/reference/block-40.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_sh61ip }}{% endhighlight %}


### Schema Compilation Errors


{% capture snippet_qzbwjx %}{% include code/from-docs/concepts/schema/reference/block-41.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_qzbwjx }}{% endhighlight %}


## Next Steps

- [Creating A Schema](creating-a-schema.md) - Back to schema creation guide
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - Property modifier reference
- [Why Schemas?](why-schemas.md) - Understanding schema benefits
