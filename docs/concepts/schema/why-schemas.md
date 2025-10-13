---
title: Why Schemas?
layout: default
parent: Schema
grand_parent: Concepts
nav_order: 7
---

# Why Schemas?

Schemas are the foundation of Routier's data management system. This document explains why schemas are important and how they benefit your application.

## Quick Navigation

- [What Are Schemas?](#what-are-schemas)
- [Benefits of Using Schemas](#benefits-of-using-schemas)
- [Real-World Examples](#real-world-examples)
- [When Not to Use Schemas](#when-not-to-use-schemas)
- [Best Practices](#best-practices)
- [Conclusion](#conclusion)
- [Next Steps](#next-steps)

## What Are Schemas?

A schema is a blueprint that defines:

- **Structure** - What properties your data has
- **Types** - What kind of values each property can hold
- **Constraints** - Rules that data must follow
- **Behavior** - How properties should behave (computed, tracked, etc.)
- **Metadata** - Information for indexing, relationships, and more

## Benefits of Using Schemas

### 1. **Type Safety**

Schemas provide compile-time type checking and type safety:

{% capture snippet_g1vs4h %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_g1vs4h | strip }}{% endhighlight %}

### 2. **Type Safety and Constraints**

Schemas ensure data structure matches your defined types, reducing bugs and improving data quality:

{% capture snippet_dzl6uk %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_dzl6uk | strip }}{% endhighlight %}

### 3. **Self-Documenting Code**

Schemas serve as living documentation of your data structures:

{% capture snippet_eybu6p %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_eybu6p | strip }}{% endhighlight %}

### 4. **Automatic Features**

Schemas enable powerful features without additional code:

{% capture snippet_malwii %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_malwii | strip }}{% endhighlight %}

### 5. **Consistent Data Handling**

Schemas ensure all parts of your application handle data the same way:

{% capture snippet_5mtp8w %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_5mtp8w | strip }}{% endhighlight %}

### 6. **Performance Optimization**

Schemas enable automatic performance optimizations:

{% capture snippet_krnwpl %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_krnwpl | strip }}{% endhighlight %}

### 7. **Change Tracking and History**

Schemas enable powerful change tracking features:

{% capture snippet_mc1w4v %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_mc1w4v | strip }}{% endhighlight %}

### 8. **Serialization and Persistence**

Schemas handle data transformation automatically:

{% capture snippet_ia38gi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_ia38gi | strip }}{% endhighlight %}

## Real-World Examples

### E-commerce Application

{% capture snippet_qq7z16 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_qq7z16 | strip }}{% endhighlight %}

### User Management System

{% capture snippet_v2efrx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_v2efrx | strip }}{% endhighlight %}

## When Not to Use Schemas

While schemas are powerful, they're not always necessary:

### **Simple Data Structures**

{% capture snippet_nusyp4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_nusyp4 | strip }}{% endhighlight %}

### **Temporary Data**

{% capture snippet_ufr7tz %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_ufr7tz | strip }}{% endhighlight %}

### **External API Responses**

{% capture snippet_itz37e %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_itz37e | strip }}{% endhighlight %}

## Best Practices

### 1. **Start Simple**

{% capture snippet_myxbxu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_myxbxu | strip }}{% endhighlight %}

### 2. **Check Structure Early**

{% capture snippet_mizzys %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_mizzys | strip }}{% endhighlight %}

### 3. **Use Computed Properties**

{% capture snippet_0wnx5f %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_0wnx5f | strip }}{% endhighlight %}

### 4. **Leverage Type Inference**

{% capture snippet_l9n9ls %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_l9n9ls | strip }}{% endhighlight %}

## Conclusion

Schemas in Routier provide a powerful foundation for building robust, type-safe, and performant applications. They offer:

- **Type Safety** - Compile-time type checking and structure validation
- **Automatic Features** - Indexing, change tracking, computed properties
- **Consistency** - Uniform data handling across your application
- **Performance** - Automatic optimizations and efficient queries
- **Maintainability** - Self-documenting, living data definitions

By embracing schemas, you'll build applications that are more reliable, performant, and easier to maintain. The initial investment in defining schemas pays dividends throughout your application's lifecycle.

## Next Steps

- [Creating A Schema](creating-a-schema.md) - Learn how to create schemas
- [Property Types](property-types/README.md) - Explore available property types
- [Modifiers](modifiers/README.md) - Understand property modifiers
- [Schema Reference](reference.md) - Complete API reference
