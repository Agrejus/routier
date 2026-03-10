---
title: Query Composer
layout: default
parent: Queries
nav_order: 7
permalink: /concepts/queries/query-composer/
---

# Query Composer

The Query Composer enables you to build reusable, parameterized queries that can be applied to collections later. This pattern is especially useful for creating query factories, sharing query logic across your application, and building complex queries with dynamic parameters.

## Quick Navigation

- [What is Query Composer?](#what-is-query-composer)
- [Why Use Query Composer?](#why-use-query-composer)
- [Basic Usage](#basic-usage)
- [Advanced Patterns](#advanced-patterns)
- [When to Use Query Composer](#when-to-use-query-composer)
- [Related Topics](#related-topics)

## What is Query Composer?

Query Composer is a way to build queries independently of a collection. Instead of starting from a collection and chaining operations, you compose a query using `Queryable.compose()` and then apply it to a collection when needed.

### The Problem It Solves

When building queries directly on collections, you must have the collection instance available:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-1.ts %}{% endhighlight %}


This works well for one-off queries, but becomes limiting when you want to:

- **Reuse query logic** across different parts of your application
- **Create query factories** that generate queries based on parameters
- **Share query definitions** without executing them immediately
- **Build queries conditionally** before knowing which collection to use

### The Solution

Query Composer separates query building from query execution:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-2.ts %}{% endhighlight %}


**Note**: You can import schemas directly instead of accessing them from the data store. This makes your query composers completely independent:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-3.ts %}{% endhighlight %}


This pattern is especially useful when:

- Building query libraries in separate modules
- Creating reusable query utilities
- Testing queries independently of data store instances

## Why Use Query Composer?

### 1. Reusable Query Logic

Create query factories that can be reused throughout your application:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-4.ts %}{% endhighlight %}


### 2. Separation of Concerns

Separate query definition from query execution. Import schemas directly to make queries completely independent:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-5.ts %}{% endhighlight %}


### 3. Complex Query Building

Build complex queries with multiple parameters and operations:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-6.ts %}{% endhighlight %}


## Basic Usage

### Creating a Simple Composer

Start with `Queryable.compose()` and pass the schema. You can access the schema from the data store or import it directly:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-7.ts %}{% endhighlight %}


### Chaining Operations

Composers support all standard query operations:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-8.ts %}{% endhighlight %}


### Using with Pagination

Composers work seamlessly with pagination:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-9.ts %}{% endhighlight %}


## Advanced Patterns

### Query Factories

Create factories that generate queries based on different criteria:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-10.ts %}{% endhighlight %}


### Conditional Query Building

Build queries conditionally based on runtime conditions:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-11.ts %}{% endhighlight %}


### Combining Composers with Additional Operations

You can apply a composer and then chain additional operations:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-12.ts %}{% endhighlight %}


## When to Use Query Composer

### Use Query Composer When:

✅ **You need reusable query logic** across multiple parts of your application  
✅ **You want to create query factories** for common query patterns  
✅ **You're building queries conditionally** based on user input or application state  
✅ **You want to separate query definition from execution** for better code organization  
✅ **You're creating query libraries** or shared query utilities

### Use Direct Queries When:

✅ **The query is simple and one-off**  
✅ **You don't need to reuse the query logic**  
✅ **The query is tightly coupled to a specific collection instance**  
✅ **You prefer the simpler, more direct syntax**

## Key Differences from Direct Queries

| Aspect               | Direct Queries                          | Query Composer                                             |
| -------------------- | --------------------------------------- | ---------------------------------------------------------- |
| **Starting Point**   | Collection instance                     | Schema                                                     |
| **Query Building**   | Built inline on collection              | Built separately, then applied via `.apply()`              |
| **Execution**        | Executes when terminal method is called | Executes when terminal method is called (after `.apply()`) |
| **Reusability**      | Limited to collection instance          | Can be reused across collections                           |
| **Parameterization** | Inline with query                       | Encapsulated in composer function                          |
| **Use Case**         | One-off queries                         | Reusable query patterns                                    |

## Best Practices

### 1. Use Descriptive Function Names


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-13.ts %}{% endhighlight %}


### 2. Group Related Queries


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-14.ts %}{% endhighlight %}


### 3. Type Your Parameters


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-15.ts %}{% endhighlight %}


### 4. Keep Composers Focused


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/query-composer/block-16.ts %}{% endhighlight %}


## Related Topics

- [Filtering Data](/concepts/queries/filtering/) - Learn about parameterized queries
- [Query Architecture](/concepts/query-architecture/) - Understand how queries work internally
- [Sorting Results](/concepts/queries/sorting/) - Learn about sorting operations
- [Pagination](/concepts/queries/pagination/) - Learn about pagination patterns
