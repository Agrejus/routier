# Creating A Schema

Schemas in Routier define the structure and behavior of your data entities. The schema builder provides a fluent, type-safe API for creating robust data schemas.

## Basic Schema Definition


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-1.ts %}{% endhighlight %}


## Schema Builder API

The `s` object provides the main entry point for schema creation:

### Core Functions

- **`s.define(collectionName, schema)`** - Creates a schema definition
- **`s.number<T>()`** - Number property with optional literal constraints
- **`s.string<T>()`** - String property with optional literal constraints
- **`s.boolean<T>()`** - Boolean property
- **`s.date<T>()`** - Date property
- **`s.array(schema)`** - Array property containing other schemas
- **`s.object(schema)`** - Object property with nested schema

### Literal Type Constraints

You can constrain properties to specific literal values:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-2.ts %}{% endhighlight %}


## Property Modifiers

Each schema type supports a set of modifiers that can be chained together:

### Core Modifiers


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-3.ts %}{% endhighlight %}


### Serialization Modifiers


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-4.ts %}{% endhighlight %}


### Array and Object Modifiers


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-5.ts %}{% endhighlight %}


## Complete Example


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-6.ts %}{% endhighlight %}


## Modifier Chaining

Modifiers can be chained in any order, but it's recommended to follow a logical pattern:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-7.ts %}{% endhighlight %}


## Compiling Schemas

Always call `.compile()` at the end to create the final schema:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/creating-a-schema/block-8.ts %}{% endhighlight %}


## Next Steps

- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - All available property modifiers
- [Schema Reference](reference.md) - Complete schema API reference
- [Why Schemas?](why-schemas.md) - Understanding the benefits of schemas
