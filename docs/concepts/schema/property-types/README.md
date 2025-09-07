# Property Types

Routier provides a comprehensive set of property types for building robust schemas. Each type can be enhanced with modifiers to specify behavior and constraints.

## Basic Types

### String


{% capture snippet_34jf1v %}{% include code/from-docs/concepts/schema/property-types/README/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_34jf1v }}{% endhighlight %}


### Number


{% capture snippet_oempxx %}{% include code/from-docs/concepts/schema/property-types/README/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_oempxx }}{% endhighlight %}


### Boolean


{% capture snippet_t1gwom %}{% include code/from-docs/concepts/schema/property-types/README/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_t1gwom }}{% endhighlight %}


### Date


{% capture snippet_0o33ad %}{% include code/from-docs/concepts/schema/property-types/README/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_0o33ad }}{% endhighlight %}


## Complex Types

### Object


{% capture snippet_y9r625 %}{% include code/from-docs/concepts/schema/property-types/README/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_y9r625 }}{% endhighlight %}


### Array


{% capture snippet_fh5wji %}{% include code/from-docs/concepts/schema/property-types/README/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_fh5wji }}{% endhighlight %}


## Type Constraints with Generics

Routier's type system allows you to constrain properties to specific literal values using TypeScript generics:

### String Literals


{% capture snippet_sepo73 %}{% include code/from-docs/concepts/schema/property-types/README/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_sepo73 }}{% endhighlight %}


### Number Literals


{% capture snippet_vo0j1n %}{% include code/from-docs/concepts/schema/property-types/README/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_vo0j1n }}{% endhighlight %}


### Boolean Literals


{% capture snippet_ep1grl %}{% include code/from-docs/concepts/schema/property-types/README/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ep1grl }}{% endhighlight %}


## Type Composition

### Combining Types


{% capture snippet_ot7kh4 %}{% include code/from-docs/concepts/schema/property-types/README/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ot7kh4 }}{% endhighlight %}


## Type Conversion

### Converting to Arrays

Any type can be converted to an array using the `.array()` modifier:


{% capture snippet_y4i5de %}{% include code/from-docs/concepts/schema/property-types/README/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_y4i5de }}{% endhighlight %}


## Special Use Cases

### Identity Properties

Properties that auto-generate values:


{% capture snippet_zbhp4c %}{% include code/from-docs/concepts/schema/property-types/README/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_zbhp4c }}{% endhighlight %}


### Key Properties

Properties that serve as unique identifiers:


{% capture snippet_myq6n4 %}{% include code/from-docs/concepts/schema/property-types/README/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_myq6n4 }}{% endhighlight %}


### Indexed Properties

Properties that create database indexes:


{% capture snippet_mtslo8 %}{% include code/from-docs/concepts/schema/property-types/README/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_mtslo8 }}{% endhighlight %}


## Best Practices

### 1. **Use Literal Types for Constrained Values**


{% capture snippet_qqb4dt %}{% include code/from-docs/concepts/schema/property-types/README/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_qqb4dt }}{% endhighlight %}


### 2. **Leverage Type Inference**


{% capture snippet_b4mi9q %}{% include code/from-docs/concepts/schema/property-types/README/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_b4mi9q }}{% endhighlight %}


### 3. **Use Appropriate Types**


{% capture snippet_u6gsr0 %}{% include code/from-docs/concepts/schema/property-types/README/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_u6gsr0 }}{% endhighlight %}


### 4. **Structure Complex Data**


{% capture snippet_unwd1x %}{% include code/from-docs/concepts/schema/property-types/README/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_unwd1x }}{% endhighlight %}


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
