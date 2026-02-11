---
title: InferType
layout: default
parent: Schema
nav_order: 6
permalink: /concepts/schema/infer-type/
---

# InferType

`InferType` is a TypeScript utility type that extracts the runtime type of entities from Routier schemas. It provides compile-time type safety by inferring the actual TypeScript type that corresponds to your schema definition.

## Quick Navigation

- [What is InferType?](#what-is-infertype)
- [Basic Usage](#basic-usage)
- [InferType vs InferCreateType](#infertype-vs-infercreatetype)
- [Real-World Examples](#real-world-examples)
- [Type Safety Benefits](#type-safety-benefits)
- [Best Practices](#best-practices)
- [Related](#related)

## What is InferType?

`InferType` takes a compiled schema and returns the TypeScript type that represents the actual entity structure at runtime. This includes:

- **All properties** defined in your schema
- **Applied modifiers** like `optional()`, `nullable()`, `default()`
- **Nested objects and arrays** with their complete structure
- **Computed properties** and their return types

## Basic Usage

{% capture snippet_infertype_basic %}{% include code/from-docs/concepts/schema/infertype-basic.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_basic | strip }}{% endhighlight %}

## InferType vs InferCreateType

Routier provides two related type utilities:

### InferType

- **Purpose**: Represents the complete entity after creation
- **Includes**: All properties, including those with defaults and identities
- **Use case**: Working with existing entities from the database

### InferCreateType

- **Purpose**: Represents the entity structure for creation
- **Excludes**: Properties with defaults (optional) and identity properties (auto-generated)
- **Use case**: Creating new entities with `addAsync()`

{% capture snippet_infertype_comparison %}{% include code/from-docs/concepts/schema/infertype-comparison.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_comparison | strip }}{% endhighlight %}

## Real-World Examples

### Function Parameters

{% capture snippet_infertype_functions %}{% include code/from-docs/concepts/schema/infertype-functions.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_functions | strip }}{% endhighlight %}

### API Responses

{% capture snippet_infertype_api %}{% include code/from-docs/concepts/schema/infertype-api.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_api | strip }}{% endhighlight %}

### Complex Nested Types

{% capture snippet_infertype_nested %}{% include code/from-docs/concepts/schema/infertype-nested.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_infertype_nested | strip }}{% endhighlight %}

## Type Safety Benefits

### Compile-Time Type Checking


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/infer-type/block-1.ts %}{% endhighlight %}


### IntelliSense Support


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/infer-type/block-2.ts %}{% endhighlight %}


### Refactoring Safety

When you change your schema, TypeScript will show errors everywhere the type is used, ensuring you update all related code.

## Best Practices

### 1. Use Type Aliases


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/infer-type/block-3.ts %}{% endhighlight %}


### 2. Export Types for Reuse


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/infer-type/block-4.ts %}{% endhighlight %}


### 3. Use Appropriate Type


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/infer-type/block-5.ts %}{% endhighlight %}


### 4. Use `constrain()` for Branded Types

When working with branded or tagged types (like UUIDs), use `constrain()` to narrow string types:


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/infer-type/block-6.ts %}{% endhighlight %}


## Related

- **[Creating A Schema](creating-a-schema.md)** - Learn how to define schemas
- **[Property Types](property-types/README.md)** - Available property types
- **[Modifiers](modifiers/README.md)** - Property modifiers and constraints
