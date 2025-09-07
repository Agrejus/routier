# Property Types

Routier provides a comprehensive set of property types for building robust schemas. Each type can be enhanced with modifiers to specify behavior and constraints.

## Basic Types

### String


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-1.ts %}{% endhighlight %}


### Number


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-2.ts %}{% endhighlight %}


### Boolean


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-3.ts %}{% endhighlight %}


### Date


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-4.ts %}{% endhighlight %}


## Complex Types

### Object


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-5.ts %}{% endhighlight %}


### Array


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-6.ts %}{% endhighlight %}


## Type Constraints with Generics

Routier's type system allows you to constrain properties to specific literal values using TypeScript generics:

### String Literals


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-7.ts %}{% endhighlight %}


### Number Literals


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-8.ts %}{% endhighlight %}


### Boolean Literals


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-9.ts %}{% endhighlight %}


## Type Composition

### Combining Types


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-10.ts %}{% endhighlight %}


## Type Conversion

### Converting to Arrays

Any type can be converted to an array using the `.array()` modifier:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-11.ts %}{% endhighlight %}


## Special Use Cases

### Identity Properties

Properties that auto-generate values:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-12.ts %}{% endhighlight %}


### Key Properties

Properties that serve as unique identifiers:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-13.ts %}{% endhighlight %}


### Indexed Properties

Properties that create database indexes:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-14.ts %}{% endhighlight %}


## Best Practices

### 1. **Use Literal Types for Constrained Values**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-15.ts %}{% endhighlight %}


### 2. **Leverage Type Inference**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-16.ts %}{% endhighlight %}


### 3. **Use Appropriate Types**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-17.ts %}{% endhighlight %}


### 4. **Structure Complex Data**


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/property-types/README/block-18.ts %}{% endhighlight %}


## Type Compatibility

### Modifier Support

Different types support different modifiers:

| Modifier         | String | Number | Boolean | Date | Object | Array |
| ---------------- | ------ | ------ | ------- | ---- | ------ | ----- |
| `.optional()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.nullable()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.default()`     | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.readonly()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.deserialize()` | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.serialize()`   | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.array()`       | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.index()`       | ✅     | ✅     | ✅      | ✅   | ✅     | ✅    |
| `.key()`         | ✅     | ✅     | ✅      | ❌   | ❌     | ❌    |
| `.identity()`    | ✅     | ✅     | ✅      | ✅   | ✅     | ❌    |
| `.distinct()`    | ✅     | ✅     | ✅      | ✅   | ❌     | ❌    |

## Summary of Types

- Array: `s.array(innerType)`
- Boolean: `s.boolean()`
- Date: `s.date()`
- Number: `s.number()`
- Object: `s.object({...})`
- String: `s.string()`

## Next Steps

- [Modifiers](modifiers/README.md) - Property modifiers and constraints
- [Creating A Schema](../creating-a-schema.md) - Back to schema creation
- [Schema Reference](../reference.md) - Complete schema API reference
