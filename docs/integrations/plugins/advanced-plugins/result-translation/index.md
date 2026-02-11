---
title: Result Translation
layout: default
parent: Advanced Plugins
grand_parent: Integrations
nav_order: 2
---

## Result Translation

After executing queries against your backend, you need to translate the raw results back into the shape expected by Routier queries. The `DataTranslator` class hierarchy provides the framework for this.

## Overview

The translator's purpose is to **adapt query results based on what the backend can or cannot do natively**. For example:

- If your backend **supports COUNT natively** (like SQL), the translator just extracts the count value from the result
- If your backend **doesn't support COUNT** (like a simple in-memory store), the translator receives all data and counts it in memory

Routier provides two main translator implementations:

- **`JsonTranslator`**: For backends that don't support query operations natively—returns all data, translator performs operations in JavaScript
- **`SqlTranslator`**: For SQL backends that handle most operations natively—translator extracts/adjusts results from SQL queries

Both extend `DataTranslator`, which orchestrates the translation process based on what operations the backend already performed.

## How Translation Works

The `DataTranslator.translate()` method processes query results by applying each query option in order:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-1.ts %}{% endhighlight %}


Translation happens in the **order operations were added** to the query, ensuring correct semantics.

## JsonTranslator

Used for backends that **don't support query operations natively**. The plugin returns all matching data, and the translator performs filtering, sorting, aggregation, and pagination in JavaScript.

### Operations Handled

#### Filtering


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-2.ts %}{% endhighlight %}


#### Sorting


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-3.ts %}{% endhighlight %}


#### Aggregations

- **count**: Returns `data.length`
- **sum**: Iterates and sums values (requires mapped field)
- **min/max**: Sorts and returns first element

#### Aggregations

Since the backend doesn't support aggregations natively:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-4.ts %}{% endhighlight %}


**Why**: These backends don't have aggregate functions, so the translator receives all matching data and performs the calculation.

#### Pagination

- **skip**: `data.slice(option.value)` - Slices array in memory
- **take**: `data.slice(0, option.value)` - Takes first N items in memory

**Why**: Backend doesn't support LIMIT/OFFSET, so translator handles pagination.

#### Distinct


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-5.ts %}{% endhighlight %}


### When to Use JsonTranslator

Use `JsonTranslator` when your backend:

- **Doesn't support filtering** → Returns all data, translator filters in memory
- **Doesn't support sorting** → Returns unsorted data, translator sorts in memory
- **Doesn't support aggregations** (COUNT, SUM, MIN, MAX) → Translator calculates from all data
- **Doesn't support pagination** → Returns all data, translator applies skip/take

Common backends:

- Memory-based stores (MemoryPlugin)
- Simple key-value stores
- Backends that only support basic retrieval

## SqlTranslator

Used for SQL backends where **the database natively supports query operations**. The translator extracts and adjusts results since the database already performed the work.

### Key Differences from JsonTranslator

1. **Count**: SQL already executed `COUNT(*)`, so extract the value

   
{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-6.ts %}{% endhighlight %}
ts
map(data: unknown, option: QueryOption<TShape, "map">): TShape {
    const response = [];

    for (const entity of data) {
        // Deserialize each mapped field
        for (const field of option.value.fields) {
            if (field.property != null) {
                const value = field.property.getValue(entity);
                if (value != null) {
                    // Deserialize (e.g., JSON.parse, Date conversion)
                    field.property.setValue(entity, field.property.deserialize(value));
                }
            }
        }

        // Apply selector to reshape
        response.push(option.value.selector(entity));
    }

    return response as TShape;
}
```

## Decision: Which Translator to Use?

The choice between `JsonTranslator` and `SqlTranslator` (or creating your own) depends on **what your backend can do natively**:

| Operation       | Backend Doesn't Support                 | Backend Supports                               |
| --------------- | --------------------------------------- | ---------------------------------------------- |
| **Filter**      | Return all data → Translator filters    | Apply WHERE → Translator passes through        |
| **Count**       | Return all data → Translator counts     | Execute COUNT(\*) → Translator extracts        |
| **Sort**        | Return unsorted → Translator sorts      | Apply ORDER BY → Translator passes through     |
| **Skip/Take**   | Return all data → Translator slices     | Apply LIMIT/OFFSET → Translator passes through |
| **Min/Max/Sum** | Return all data → Translator calculates | Execute aggregate → Translator extracts        |

### Hybrid Approach

Your backend might support some operations but not others. You can create a custom translator that:

- Passes through operations your backend handles (like `SqlTranslator`)
- Performs operations your backend doesn't handle (like `JsonTranslator`)

## Creating Your Own Translator

If your backend needs custom translation logic, extend `DataTranslator` and implement methods based on what your backend supports:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-7.ts %}{% endhighlight %}


### Usage in Plugin

The `DataTranslator.translate()` method automatically wraps results in `ITranslatedValue`, so you don't need to manually wrap them:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-8.ts %}{% endhighlight %}


## Common Patterns

### Deserialization

The schema handles deserialization automatically through property-level `deserialize()` methods. You don't need to manually deserialize in the translator. The `map` operation already handles deserialization for mapped fields:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-9.ts %}{% endhighlight %}


If your backend returns raw data that needs schema-level deserialization, handle it in your plugin's `query` method before passing to the translator, not in the translator itself.

### Hybrid: Backend Supports Some Operations

If your backend supports some operations but not others, check what was handled:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-10.ts %}{% endhighlight %}


### Filtering After Fetch

If your backend doesn't support certain filters, fetch and filter in memory:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-11.ts %}{% endhighlight %}


The key principle: **If your backend already did the work, extract the result. If not, do the work in the translator.**

### Result Shaping

Transform backend-specific result structures:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/advanced-plugins/result-translation/index/block-12.ts %}{% endhighlight %}


## Reference Implementations

- **[JsonTranslator](https://github.com/agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts)**: Full in-memory operations
- **[SqlTranslator](https://github.com/agrejus/routier/blob/main/core/src/plugins/translators/SqlTranslator.ts)**: SQL result handling
- **[PouchDbTranslator](https://github.com/agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbTranslator.ts)**: Custom deserialization example

## Testing

See [JsonTranslator.test.ts](https://github.com/agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.test.ts) for comprehensive test examples covering all translation operations.
