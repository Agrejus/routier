# Creating A Schema

Schemas in Routier define the structure and behavior of your data entities. The schema builder provides a fluent, type-safe API for creating robust data schemas.

## Basic Schema Definition


{% capture snippet_uwvygh %}{% include code/from-docs/concepts/schema/creating-a-schema/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_uwvygh }}{% endhighlight %}


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


{% capture snippet_r07whk %}{% include code/from-docs/concepts/schema/creating-a-schema/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_r07whk }}{% endhighlight %}


## Property Modifiers

Each schema type supports a set of modifiers that can be chained together:

### Core Modifiers


{% capture snippet_834udw %}{% include code/from-docs/concepts/schema/creating-a-schema/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_834udw }}{% endhighlight %}


### Serialization Modifiers


{% capture snippet_5wxct0 %}{% include code/from-docs/concepts/schema/creating-a-schema/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_5wxct0 }}{% endhighlight %}


### Array and Object Modifiers


{% capture snippet_rl0i32 %}{% include code/from-docs/concepts/schema/creating-a-schema/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_rl0i32 }}{% endhighlight %}


## Complete Example


{% capture snippet_btkdlv %}{% include code/from-docs/concepts/schema/creating-a-schema/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_btkdlv }}{% endhighlight %}


## Modifier Chaining

Modifiers can be chained in any order, but it's recommended to follow a logical pattern:


{% capture snippet_yeelah %}{% include code/from-docs/concepts/schema/creating-a-schema/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_yeelah }}{% endhighlight %}


## Compiling Schemas

Always call `.compile()` at the end to create the final schema:


{% capture snippet_k6k6vd %}{% include code/from-docs/concepts/schema/creating-a-schema/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_k6k6vd }}{% endhighlight %}


## Next Steps

- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - All available property modifiers
- [Schema Reference](reference.md) - Complete schema API reference
- [Why Schemas?](why-schemas.md) - Understanding the benefits of schemas
