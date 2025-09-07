---
title: Property Types
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 2
---

# Property Types

Routier provides a comprehensive set of property types for building robust schemas. Each type can be enhanced with modifiers to specify behavior and constraints.

## Basic Types

### String

{% capture snippet_34jf1v %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_34jf1v | escape }}{% endhighlight %}

### Number

{% capture snippet_oempxx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_oempxx | escape }}{% endhighlight %}

### Boolean

{% capture snippet_t1gwom %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_t1gwom | escape }}{% endhighlight %}

### Date

{% capture snippet_0o33ad %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_0o33ad | escape }}{% endhighlight %}

## Complex Types

### Object

{% capture snippet_y9r625 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_y9r625 | escape }}{% endhighlight %}

### Array

{% capture snippet_fh5wji %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fh5wji | escape }}{% endhighlight %}

## Type Constraints with Generics

Routier's type system allows you to constrain properties to specific literal values using TypeScript generics:

### String Literals

{% capture snippet_sepo73 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sepo73 | escape }}{% endhighlight %}

### Number Literals

{% capture snippet_vo0j1n %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_vo0j1n | escape }}{% endhighlight %}

### Boolean Literals

{% capture snippet_ep1grl %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ep1grl | escape }}{% endhighlight %}

## Type Composition

### Combining Types

{% capture snippet_ot7kh4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ot7kh4 | escape }}{% endhighlight %}

## Type Conversion

### Converting to Arrays

Any type can be converted to an array using the `.array()` modifier:

{% capture snippet_y4i5de %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_y4i5de | escape }}{% endhighlight %}

## Special Use Cases

### Identity Properties

Properties that auto-generate values:

{% capture snippet_zbhp4c %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zbhp4c | escape }}{% endhighlight %}

### Key Properties

Properties that serve as unique identifiers:

{% capture snippet_myq6n4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_myq6n4 | escape }}{% endhighlight %}

### Indexed Properties

Properties that create database indexes:

{% capture snippet_mtslo8 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_mtslo8 | escape }}{% endhighlight %}

## Best Practices

### 1. **Use Literal Types for Constrained Values**

{% capture snippet_qqb4dt %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_qqb4dt | escape }}{% endhighlight %}

### 2. **Leverage Type Inference**

{% capture snippet_b4mi9q %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_b4mi9q | escape }}{% endhighlight %}

### 3. **Use Appropriate Types**

{% capture snippet_u6gsr0 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_u6gsr0 | escape }}{% endhighlight %}

### 4. **Structure Complex Data**

{% capture snippet_unwd1x %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_unwd1x | escape }}{% endhighlight %}

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
