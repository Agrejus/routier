# Schema Reference

Complete API reference for Routier schemas, including all methods, types, and advanced features.

## Schema Builder

### `s.object()`

Creates an object schema with the specified properties.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-1.ts %}{% endhighlight %}


### `s.define(name, properties)`

Defines a named schema with properties and returns a schema builder.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-2.ts %}{% endhighlight %}


### `s.array(elementType)`

Creates an array schema with the specified element type.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-3.ts %}{% endhighlight %}


### `s.union(types)`

Creates a union schema that accepts any of the specified types.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-4.ts %}{% endhighlight %}


### `s.literal(...values)`

Creates a literal schema that only accepts the specified values.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-5.ts %}{% endhighlight %}


### `s.any()`

Creates a schema that accepts any value.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-6.ts %}{% endhighlight %}


### `s.unknown()`

Creates a schema that accepts unknown values (safer than `any`).


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-7.ts %}{% endhighlight %}


### `s.record(keyType, valueType)`

Creates a record schema for key-value pairs.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-8.ts %}{% endhighlight %}


## Property Types

### String Properties


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-9.ts %}{% endhighlight %}


### Number Properties


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-10.ts %}{% endhighlight %}


### Boolean Properties


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-11.ts %}{% endhighlight %}


### Date Properties


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-12.ts %}{% endhighlight %}


## Property Modifiers

### Identity and Keys


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-13.ts %}{% endhighlight %}


### Indexing


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-14.ts %}{% endhighlight %}


### Validation


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-15.ts %}{% endhighlight %}


### Defaults and Values


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-16.ts %}{% endhighlight %}


### Behavior Control


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-17.ts %}{% endhighlight %}


### Serialization


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-18.ts %}{% endhighlight %}


## Schema Modification

### `.modify(modifier)`

Applies modifications to the schema.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-19.ts %}{% endhighlight %}


### Computed Properties


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-20.ts %}{% endhighlight %}


### Function Properties


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-21.ts %}{% endhighlight %}


## Schema Compilation

### `.compile()`

Compiles the schema into its final form.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-22.ts %}{% endhighlight %}


## Schema Information

### `.getProperties()`

Returns information about all properties in the schema.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-23.ts %}{% endhighlight %}


### `.getIndexes()`

Returns information about all indexes in the schema.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-24.ts %}{% endhighlight %}


### `.getIdProperties()`

Returns information about identity properties.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-25.ts %}{% endhighlight %}


### `.hasIdentityKeys`

Boolean indicating if the schema has identity keys.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-26.ts %}{% endhighlight %}


## Type Inference

### `InferType<T>`

Extracts the TypeScript type from a schema.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-27.ts %}{% endhighlight %}


### `InferCreateType<T>`

Extracts the creation type (without identity fields).


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-28.ts %}{% endhighlight %}


## Schema Structure Checking

### `.validate(data)`

Validates data against the schema.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-29.ts %}{% endhighlight %}


### `.isValid(data)`

Quick check if data is valid.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-30.ts %}{% endhighlight %}


## Schema Serialization

### `.serialize(data)`

Serializes data according to schema rules.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-31.ts %}{% endhighlight %}


### `.deserialize(data)`

Deserializes data according to schema rules.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-32.ts %}{% endhighlight %}


## Advanced Features

### Custom Validators


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-33.ts %}{% endhighlight %}


### Conditional Validation


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-34.ts %}{% endhighlight %}


### Dynamic Schemas


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-35.ts %}{% endhighlight %}


## Best Practices

### 1. **Schema Organization**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-36.ts %}{% endhighlight %}


### 2. **Validation Strategy**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-37.ts %}{% endhighlight %}


### 3. **Type Safety**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-38.ts %}{% endhighlight %}


### 4. **Performance Considerations**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-39.ts %}{% endhighlight %}


## Error Handling

### Validation Errors


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-40.ts %}{% endhighlight %}


### Schema Compilation Errors


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/reference/block-41.ts %}{% endhighlight %}


## Next Steps

- [Creating A Schema](creating-a-schema.md) - Back to schema creation guide
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - Property modifier reference
- [Why Schemas?](why-schemas.md) - Understanding schema benefits
